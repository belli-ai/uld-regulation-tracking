"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  PackageCheck,
  PlaneLanding,
  PlaneTakeoff,
  ScanLine,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import scenariosData from "@/public/data/scenarios.json";
import {
  BudgetPreflightRow,
  type BudgetForecast,
} from "@/components/budget-preflight-row";
import { DgCheckRow } from "@/components/dg-check-row";
import {
  MetricTile,
  MissionHero,
  MissionPanel,
  MissionShell,
  MissionTopBar,
} from "@/components/mission-control";
import { ShcCompatRow } from "@/components/shc-compat-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { budgetPreflight } from "@/lib/build-up/budget-preflight";
import { dgChecker, type DgValidationResult } from "@/lib/build-up/dg-checker";
import { shcCompat } from "@/lib/build-up/shc-compat";
import { signOff } from "@/lib/build-up/sign-off";
import { type CanonicalWeather } from "@/lib/adapters/weather";
import {
  type Scenario,
  scenariosFileSchema,
} from "@/lib/simulator/scenario-schema";
import { startTrackerFeed } from "@/lib/simulator/tracker-feed";
import { auditDb } from "@/lib/persistence/audit-db";
import { useUldStore } from "@/lib/stores/uld-store";
import { useInventoryStore } from "@/lib/stores/inventory-store";
import {
  toIRI,
  type Measurement,
  type Piece,
  type TemperatureInstructions,
  type TransportMovement,
  type ULD,
  type Waybill,
} from "@/lib/ontology/one-record";
import { cn } from "@/lib/utils";

type Props = {
  flightNo: string;
  uldId: string;
};

type BuildUpFlight = TransportMovement & {
  aircraftBody?: string;
  aircraftCategory?: "cargo" | "passenger";
};

export type BuildUpPiece = Piece & {
  awbNumber: string;
  dgDeclaration?: string;
  dgValidation?: DgValidationResult;
  dgValidationReason?: string;
  dgValidationStatus?: DgValidationResult["status"];
  shc?: string;
  temperatureInstructions?: TemperatureInstructions;
};

export type BuildUpWaybill = Waybill & {
  consignor?: string;
  description?: string;
  flightNumber?: string;
  pieces: BuildUpPiece[];
};

type BuildUpUld = ULD & {
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
  uldProductCode?: string;
};

type RawWeight = {
  unit?: unknown;
  value?: unknown;
};

type RawTemperatureInstructions = {
  "@id"?: unknown;
  "@type"?: unknown;
  maxTemperature?: {
    unit?: unknown;
    value?: unknown;
  };
  minTemperature?: {
    unit?: unknown;
    value?: unknown;
  };
};

type RawPiece = {
  "@id"?: unknown;
  "@type"?: unknown;
  dgDeclaration?: unknown;
  dimensions?: {
    height?: unknown;
    length?: unknown;
    unit?: unknown;
    width?: unknown;
  };
  fulfillsUldTypeCode?: unknown;
  grossWeight?: RawWeight;
  ofShipment?: unknown;
  shc?: unknown;
  temperatureInstructions?: RawTemperatureInstructions;
};

type RawWaybill = {
  "@id"?: unknown;
  "@type"?: unknown;
  arrivalLocation?: unknown;
  consignor?: unknown;
  declaredValueForCarriage?: {
    currency?: unknown;
    value?: unknown;
  };
  departureLocation?: unknown;
  description?: unknown;
  flightNumber?: unknown;
  pieces?: unknown;
  shc?: unknown;
  shipmentDetails?: unknown;
  waybillNumber?: unknown;
  waybillPrefix?: unknown;
};

type RawFlight = {
  "@id"?: unknown;
  "@type"?: unknown;
  aircraftBody?: unknown;
  aircraftCategory?: unknown;
  arrivalLocation?: unknown;
  departureLocation?: unknown;
  flightNumber?: unknown;
  loadingActions?: unknown;
  modeCode?: unknown;
  movementTimes?: unknown;
  operatingParties?: unknown;
};

type RawUld = {
  "@id"?: unknown;
  "@type"?: unknown;
  ataDesignator?: unknown;
  damageFlag?: unknown;
  iotDeviceId?: unknown;
  lastKnownInternalC?: unknown;
  lastKnownLocation?: unknown;
  loadingIndicator?: unknown;
  numberOfDoors?: unknown;
  ownerCode?: unknown;
  sealNumber?: unknown;
  serviceabilityCode?: unknown;
  uldProductCode?: unknown;
  uldSerialNumber?: unknown;
  uldTypeCode?: unknown;
};

type DragPayload = {
  waybillId: string;
};

type ParsedBuildData = {
  flight: BuildUpFlight | null;
  manifest: BuildUpWaybill[];
  uld: BuildUpUld | null;
};

type DataState =
  | { status: "loading" }
  | { status: "ready"; value: ParsedBuildData }
  | { message: string; status: "error" };

export type BuildUpDropRejection = {
  awbId: BuildUpWaybill["@id"];
  awbLabel: string;
  reasons: string[];
};

type TrackerRegistryEntry = {
  stop: () => void;
  unsubscribe: () => void;
};

declare global {
  interface Window {
    __coolChainTrackerFeeds?: Record<string, TrackerRegistryEntry>;
  }
}

const scenarios = scenariosFileSchema.parse(scenariosData).scenarios;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLocationCode(value: string): string {
  return value.split(":").at(-1) ?? value;
}

function getWaybillLabel(
  waybill: Pick<BuildUpWaybill, "waybillNumber" | "waybillPrefix">,
): string {
  return `${waybill.waybillPrefix}-${waybill.waybillNumber}`;
}

function getMovementTimes(value: unknown): BuildUpFlight["movementTimes"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as { timestamp?: unknown; type?: unknown };
    const type = candidate.type;
    const timestamp = candidate.timestamp;
    if (
      (type === "STD" || type === "STA" || type === "ATD" || type === "ATA") &&
      typeof timestamp === "string"
    ) {
      return [{ type, timestamp }];
    }

    return [];
  });
}

function getIriList(value: unknown): ReturnType<typeof toIRI>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) =>
    typeof entry === "string" ? [toIRI(entry)] : [],
  );
}

function parseTemperatureInstructions(
  value: unknown,
): TemperatureInstructions | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }

  const raw = value as RawTemperatureInstructions;
  const minValue = asNumber(raw.minTemperature?.value);
  const maxValue = asNumber(raw.maxTemperature?.value);
  const minUnit = raw.minTemperature?.unit;
  const maxUnit = raw.maxTemperature?.unit;
  const id = asString(raw["@id"]);

  if (
    id === null ||
    minValue === null ||
    maxValue === null ||
    (minUnit !== "C" && minUnit !== "F") ||
    (maxUnit !== "C" && maxUnit !== "F")
  ) {
    return undefined;
  }

  return {
    "@id": toIRI(id),
    "@type": "TemperatureInstructions",
    minTemperature: { unit: minUnit, value: minValue },
    maxTemperature: { unit: maxUnit, value: maxValue },
  };
}

function parsePiece(
  value: unknown,
  awbNumber: string,
  shc: string,
): BuildUpPiece | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const raw = value as RawPiece;
  const id = asString(raw["@id"]);
  const ofShipment = asString(raw.ofShipment);
  const grossWeightValue = asNumber(raw.grossWeight?.value);
  const grossWeightUnit = raw.grossWeight?.unit === "lb" ? "lb" : "kg";
  if (id === null || ofShipment === null || grossWeightValue === null) {
    return null;
  }

  const piece: BuildUpPiece = {
    "@id": toIRI(id),
    "@type": "Piece",
    awbNumber,
    grossWeight: { unit: grossWeightUnit, value: grossWeightValue },
    ofShipment: toIRI(ofShipment),
    shc,
  };

  if (raw.dimensions != null && typeof raw.dimensions === "object") {
    const length = asNumber(raw.dimensions.length);
    const width = asNumber(raw.dimensions.width);
    const height = asNumber(raw.dimensions.height);
    if (length !== null && width !== null && height !== null) {
      piece.dimensions = { height, length, unit: "cm", width };
    }
  }

  const temperatureInstructions = parseTemperatureInstructions(
    raw.temperatureInstructions,
  );
  if (temperatureInstructions) {
    piece.temperatureInstructions = temperatureInstructions;
  }

  const dgDeclaration = asString(raw.dgDeclaration);
  if (dgDeclaration !== null) {
    piece.dgDeclaration = dgDeclaration;
  }

  const fulfillsUldTypeCode = asString(raw.fulfillsUldTypeCode);
  if (fulfillsUldTypeCode !== null) {
    piece.fulfillsUldTypeCode = fulfillsUldTypeCode;
  }

  const pieceShc = asString(raw.shc);
  if (pieceShc !== null) {
    piece.shc = pieceShc;
  }

  return piece;
}

function parseWaybill(value: unknown): BuildUpWaybill | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const raw = value as RawWaybill;
  const id = asString(raw["@id"]);
  const prefix = asString(raw.waybillPrefix);
  const number = asString(raw.waybillNumber);
  const departureLocation = asString(raw.departureLocation);
  const arrivalLocation = asString(raw.arrivalLocation);
  const shc = asString(raw.shc) ?? "GEN";
  if (
    id === null ||
    prefix === null ||
    number === null ||
    departureLocation === null ||
    arrivalLocation === null
  ) {
    return null;
  }

  const awbNumber = `${prefix}-${number}`;
  const pieces = Array.isArray(raw.pieces)
    ? raw.pieces.flatMap((piece) => {
        const parsed = parsePiece(piece, awbNumber, shc);
        return parsed ? [parsed] : [];
      })
    : [];

  const waybill: BuildUpWaybill = {
    "@id": toIRI(id),
    "@type": "Waybill",
    arrivalLocation: toIRI(arrivalLocation),
    departureLocation: toIRI(departureLocation),
    pieces,
    shc,
    waybillNumber: number,
    waybillPrefix: prefix,
  };

  const description = asString(raw.description);
  if (description !== null) {
    waybill.description = description;
  }

  const consignor = asString(raw.consignor);
  if (consignor !== null) {
    waybill.consignor = consignor;
  }

  const flightNumber = asString(raw.flightNumber);
  if (flightNumber !== null) {
    waybill.flightNumber = flightNumber;
  }

  if (
    raw.declaredValueForCarriage != null &&
    typeof raw.declaredValueForCarriage === "object"
  ) {
    const amount = asNumber(raw.declaredValueForCarriage.value);
    const currency = asString(raw.declaredValueForCarriage.currency);
    if (amount !== null && currency !== null) {
      waybill.declaredValueForCarriage = { currency, value: amount };
    }
  }

  const shipmentDetails = asString(raw.shipmentDetails);
  if (shipmentDetails !== null) {
    waybill.shipmentDetails = toIRI(shipmentDetails);
  }

  return waybill;
}

function parseFlight(value: unknown): BuildUpFlight | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const raw = value as RawFlight;
  const id = asString(raw["@id"]);
  const flightNumber = asString(raw.flightNumber);
  const departureLocation = asString(raw.departureLocation);
  const arrivalLocation = asString(raw.arrivalLocation);
  if (
    id === null ||
    flightNumber === null ||
    departureLocation === null ||
    arrivalLocation === null
  ) {
    return null;
  }

  const flight: BuildUpFlight = {
    "@id": toIRI(id),
    "@type": "TransportMovement",
    arrivalLocation: toIRI(arrivalLocation),
    departureLocation: toIRI(departureLocation),
    flightNumber,
    loadingActions: getIriList(raw.loadingActions),
    modeCode: "Air",
    movementTimes: getMovementTimes(raw.movementTimes),
    operatingParties: getIriList(raw.operatingParties),
  };

  if (
    raw.aircraftCategory === "cargo" ||
    raw.aircraftCategory === "passenger"
  ) {
    flight.aircraftCategory = raw.aircraftCategory;
  }

  const aircraftBody = asString(raw.aircraftBody);
  if (aircraftBody !== null) {
    flight.aircraftBody = aircraftBody;
  }

  return flight;
}

function parseUld(value: unknown): BuildUpUld | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const raw = value as RawUld;
  const id = asString(raw["@id"]);
  const uldSerialNumber = asString(raw.uldSerialNumber);
  const uldTypeCode = asString(raw.uldTypeCode);
  const ownerCode = asString(raw.ownerCode);
  const serviceabilityCode = raw.serviceabilityCode;
  if (
    id === null ||
    uldSerialNumber === null ||
    uldTypeCode === null ||
    ownerCode === null ||
    (serviceabilityCode !== "SER" &&
      serviceabilityCode !== "DAM" &&
      serviceabilityCode !== "CON")
  ) {
    return null;
  }

  const uld: BuildUpUld = {
    "@id": toIRI(id),
    "@type": "ULD",
    damageFlag: raw.damageFlag === true,
    ownerCode,
    serviceabilityCode,
    uldSerialNumber,
    uldTypeCode,
  };

  const ataDesignator = asString(raw.ataDesignator);
  if (ataDesignator !== null) {
    uld.ataDesignator = ataDesignator;
  }

  const loadingIndicator = asString(raw.loadingIndicator);
  if (loadingIndicator !== null) {
    uld.loadingIndicator = loadingIndicator;
  }

  const sealNumber = asString(raw.sealNumber);
  if (sealNumber !== null) {
    uld.sealNumber = sealNumber;
  }

  const numberOfDoors = asNumber(raw.numberOfDoors);
  if (numberOfDoors !== null) {
    uld.numberOfDoors = numberOfDoors;
  }

  const uldProductCode = asString(raw.uldProductCode);
  if (uldProductCode !== null) {
    uld.uldProductCode = uldProductCode;
  }

  const iotDeviceId = asString(raw.iotDeviceId);
  if (iotDeviceId !== null) {
    uld.iotDeviceId = iotDeviceId;
  }

  const lastKnownLocation = asString(raw.lastKnownLocation);
  if (lastKnownLocation !== null) {
    uld.lastKnownLocation = lastKnownLocation;
  }

  const lastKnownInternalC = asNumber(raw.lastKnownInternalC);
  if (lastKnownInternalC !== null) {
    uld.lastKnownInternalC = lastKnownInternalC;
  }

  return uld;
}

function flattenPieces(contents: BuildUpWaybill[]): BuildUpPiece[] {
  return contents.flatMap((waybill) => waybill.pieces);
}

function totalWeightKg(waybills: BuildUpWaybill[]): number {
  return flattenPieces(waybills).reduce((sum, piece) => {
    const weight =
      piece.grossWeight.unit === "lb"
        ? piece.grossWeight.value * 0.453592
        : piece.grossWeight.value;
    return sum + weight;
  }, 0);
}

function toAmbientCurve(hourly: CanonicalWeather["hourly"]): Measurement[] {
  return hourly.slice(0, 24).map((reading, index) => ({
    "@id": toIRI(`urn:cargo:measurement:ambient:${index}:${reading.timestamp}`),
    "@type": "Measurement",
    bySensor: toIRI("urn:cargo:sensor:ambient:forecast"),
    measurementTimestamp: reading.timestamp,
    measurementValue: {
      unit: "C",
      value: reading.ambientC,
    },
  }));
}

function toResultMap(
  results: DgValidationResult[],
): Map<Piece["@id"], DgValidationResult> {
  return new Map(
    results.map((result) => [result.piece["@id"], result] as const),
  );
}

function withValidation(
  pieces: BuildUpPiece[],
  resultMap: Map<Piece["@id"], DgValidationResult>,
): BuildUpPiece[] {
  return pieces.map((piece) => {
    const result = resultMap.get(piece["@id"]);
    if (!result) {
      return piece;
    }

    return {
      ...piece,
      dgValidation: result,
      dgValidationReason:
        result.status === "rejected" ? result.reason : undefined,
      dgValidationStatus: result.status,
    };
  });
}

function findScenario(flightNo: string, uldSerialNumber: string): Scenario {
  return (
    scenarios.find((scenario) =>
      scenario.events?.some(
        (event) =>
          event.uldId === uldSerialNumber && event.flightNo === flightNo,
      ),
    ) ??
    scenarios.find((scenario) => scenario.id === "dxb-warehouse-demo") ??
    scenarios[0]
  );
}

function startMeasurementStreaming(
  uldSerialNumber: string,
  flightNo: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const registry = (window.__coolChainTrackerFeeds ??= {});
  registry[uldSerialNumber]?.unsubscribe();
  registry[uldSerialNumber]?.stop();

  const scenario = findScenario(flightNo, uldSerialNumber);
  const startedAt = Date.now();
  const feed = startTrackerFeed(
    uldSerialNumber,
    scenario,
    () => Date.now() - startedAt,
  );

  if (feed === null) {
    return;
  }

  const subscription = feed.subscribe((measurements: Measurement[]) => {
    try {
      sessionStorage.setItem(
        `cool-chain:tracker:${uldSerialNumber}`,
        JSON.stringify(measurements),
      );
    } catch (error) {
      console.error("Failed to persist tracker measurements", error);
    }
  });

  registry[uldSerialNumber] = {
    stop: feed.stop,
    unsubscribe: subscription.unsubscribe,
  };
}

async function loadBuildData(
  flightNo: string,
  uldId: string,
): Promise<ParsedBuildData> {
  const [flightsResponse, shipmentsResponse, inventoryResponse] =
    await Promise.all([
      fetch(`/data/flights.json?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/data/shipments.json?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/data/uld-inventory.json?t=${Date.now()}`, { cache: "no-store" }),
    ]);

  if (!flightsResponse.ok || !shipmentsResponse.ok || !inventoryResponse.ok) {
    throw new Error("One or more build-up fixtures could not be loaded.");
  }

  const flightsRaw = (await flightsResponse.json()) as unknown;
  const shipmentsRaw = (await shipmentsResponse.json()) as unknown;
  const inventoryRaw = (await inventoryResponse.json()) as unknown;

  const flights = Array.isArray(flightsRaw)
    ? flightsRaw.flatMap((entry) => {
        const parsed = parseFlight(entry);
        return parsed ? [parsed] : [];
      })
    : [];

  const inventory = Array.isArray(inventoryRaw)
    ? inventoryRaw.flatMap((entry) => {
        const parsed = parseUld(entry);
        return parsed ? [parsed] : [];
      })
    : [];

  const shipmentsMap =
    shipmentsRaw != null && typeof shipmentsRaw === "object"
      ? (shipmentsRaw as Record<string, unknown>)
      : {};

  const manifest = Array.isArray(shipmentsMap[flightNo])
    ? shipmentsMap[flightNo].flatMap((entry) => {
        const parsed = parseWaybill(entry);
        return parsed ? [parsed] : [];
      })
    : [];

  const flight =
    flights.find((entry) => entry.flightNumber === flightNo) ?? null;
  const uld =
    inventory.find(
      (entry) =>
        entry["@id"] === toIRI(uldId) || entry.uldSerialNumber === uldId,
    ) ?? null;

  return { flight, manifest, uld };
}

async function loadWeather(airport: string): Promise<CanonicalWeather> {
  const response = await fetch(`/api/weather?airport=${airport}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  return (await response.json()) as CanonicalWeather;
}

function forecastTone(
  forecast: BudgetForecast | null,
  hasPieces: boolean,
): "green" | "yellow" | "red" {
  if (!hasPieces || forecast === null) {
    return "yellow";
  }
  return forecast.warning;
}

function shcTone(ok: boolean, hasPieces: boolean): "green" | "yellow" | "red" {
  if (!hasPieces) {
    return "yellow";
  }
  return ok ? "green" : "red";
}

function getStdLabel(flight: BuildUpFlight | null): string {
  const std = flight?.movementTimes.find(
    (entry) => entry.type === "STD",
  )?.timestamp;
  return std ? new Date(std).toLocaleString() : "STD unavailable";
}

export function BuildUpCanvas({ flightNo, uldId }: Props) {
  const router = useRouter();
  const addBuiltUld = useUldStore((state) => state.addBuiltUld);
  const builtContents = useUldStore((state) => state.contents);
  const releaseFromBuildUp = useInventoryStore(
    (state) => state.releaseFromBuildUp,
  );
  const [dataState, setDataState] = useState<DataState>({ status: "loading" });
  const [weather, setWeather] = useState<CanonicalWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [contents, setContents] = useState<BuildUpWaybill[]>([]);
  const [dgResults, setDgResults] = useState<DgValidationResult[]>([]);
  const [checkingDg, setCheckingDg] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dropRejection, setDropRejection] =
    useState<BuildUpDropRejection | null>(null);
  const [sealNumber, setSealNumber] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState(false);
  const [confirmOverrideOpen, setConfirmOverrideOpen] = useState(false);
  const [budgetForecast, setBudgetForecast] = useState<BudgetForecast | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setDataState({ status: "loading" });
        const loaded = await loadBuildData(flightNo, uldId);
        if (!cancelled) {
          setDataState({ status: "ready", value: loaded });
          setSealNumber(loaded.uld?.sealNumber ?? "");
        }

        try {
          const departureCode = loaded.flight
            ? getLocationCode(String(loaded.flight.departureLocation))
            : "DXB";
          const weatherData = await loadWeather(departureCode);
          if (!cancelled) {
            setWeather(weatherData);
            setWeatherError(null);
          }
        } catch (error) {
          console.error("Weather forecast failed to load", error);
          if (!cancelled) {
            setWeather(null);
            setWeatherError(
              error instanceof Error
                ? error.message
                : "Projected ambient could not be loaded.",
            );
          }
        }
      } catch (error) {
        console.error("Build-up canvas failed to load", error);
        if (!cancelled) {
          if (error instanceof Error) {
            setDataState({ message: error.message, status: "error" });
          } else {
            setDataState({
              message: "Build-up canvas failed to load.",
              status: "error",
            });
          }
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [flightNo, uldId]);

  const flight = dataState.status === "ready" ? dataState.value.flight : null;
  const manifest = useMemo(
    () => (dataState.status === "ready" ? dataState.value.manifest : []),
    [dataState],
  );
  const uld = dataState.status === "ready" ? dataState.value.uld : null;
  const projectedAmbient = useMemo(
    () => (weather ? toAmbientCurve(weather.hourly) : []),
    [weather],
  );
  const contentPieces = useMemo(() => flattenPieces(contents), [contents]);
  const dgResultMap = useMemo(() => toResultMap(dgResults), [dgResults]);
  const validatedPieces = useMemo(
    () => withValidation(contentPieces, dgResultMap),
    [contentPieces, dgResultMap],
  );
  const shcResult = useMemo(
    () => shcCompat.compatible(validatedPieces),
    [validatedPieces],
  );
  const loadedWaybillIds = useMemo(
    () => new Set(contents.map((waybill) => waybill["@id"])),
    [contents],
  );
  const assignedWaybillIdsOutsideCurrentUld = useMemo(() => {
    const assigned = new Set<string>();

    for (const [builtUldId, waybills] of Object.entries(builtContents)) {
      if (uld && builtUldId === uld["@id"]) {
        continue;
      }

      for (const waybill of waybills) {
        assigned.add(waybill["@id"]);
      }
    }

    return assigned;
  }, [builtContents, uld]);
  const availableManifest = useMemo(
    () =>
      manifest.filter(
        (waybill) =>
          !loadedWaybillIds.has(waybill["@id"]) &&
          !assignedWaybillIdsOutsideCurrentUld.has(waybill["@id"]),
      ),
    [assignedWaybillIdsOutsideCurrentUld, loadedWaybillIds, manifest],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (
        !uld ||
        validatedPieces.length === 0 ||
        projectedAmbient.length === 0
      ) {
        setBudgetForecast(null);
        return;
      }

      try {
        const nextForecast = budgetPreflight.forecast(
          uld,
          validatedPieces,
          projectedAmbient,
        );
        if (!cancelled) {
          setBudgetForecast(nextForecast);
        }
      } catch (error) {
        console.error("Budget forecast failed", error);
        if (!cancelled) {
          setBudgetForecast(null);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [projectedAmbient, uld, validatedPieces]);

  const dgStatusTone =
    dropRejection !== null ||
    dgResults.some((result) => result.status === "rejected")
      ? "red"
      : checkingDg || validatedPieces.length === 0
        ? "yellow"
        : "green";
  const shcStatusTone = shcTone(shcResult.ok, validatedPieces.length > 0);
  const budgetStatusTone = forecastTone(
    budgetForecast,
    validatedPieces.length > 0,
  );
  // Budget pre-flight is informational at build-up time — the ULD is still
  // in the cool room, the budget forecast is for projected exposure once it
  // leaves. Don't block sign-off on it; let DG and SHC be the only blockers.
  const hasRedValidation = dgStatusTone === "red" || shcStatusTone === "red";
  const signOffDisabled =
    validatedPieces.length === 0 ||
    sealNumber.trim().length === 0 ||
    checkingDg ||
    signingOff;

  async function handleDrop(payload: DragPayload) {
    if (!flight || !uld) {
      return;
    }

    const waybill = manifest.find(
      (entry) => entry["@id"] === toIRI(payload.waybillId),
    );
    if (
      !waybill ||
      loadedWaybillIds.has(waybill["@id"]) ||
      assignedWaybillIdsOutsideCurrentUld.has(waybill["@id"])
    ) {
      return;
    }

    const nextContents = [...contents, waybill];
    setCheckingDg(true);
    setSubmitError(null);

    try {
      const nextResults = await dgChecker.validate(
        flattenPieces(nextContents),
        getLocationCode(String(flight.departureLocation)),
        getLocationCode(String(flight.arrivalLocation)),
        flight.flightNumber,
        flight.aircraftCategory ?? "passenger",
      );
      const rejected = nextResults.filter(
        (result) => result.status === "rejected",
      );

      if (rejected.length > 0) {
        setDropRejection({
          awbId: waybill["@id"],
          awbLabel: getWaybillLabel(waybill),
          reasons: rejected.map((result) => result.reason),
        });
        return;
      }

      setContents(nextContents);
      setDgResults(nextResults);
      setDropRejection(null);
    } catch (error) {
      console.error("DG validation failed", error);
      setDropRejection({
        awbId: waybill["@id"],
        awbLabel: getWaybillLabel(waybill),
        reasons: [
          error instanceof Error
            ? error.message
            : "DG validation request failed.",
        ],
      });
    } finally {
      setCheckingDg(false);
    }
  }

  function handleDragStart(
    waybill: BuildUpWaybill,
    event: DragEvent<HTMLDivElement>,
  ) {
    const payload: DragPayload = { waybillId: String(waybill["@id"]) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  function handleRemoveWaybill(waybillId: BuildUpWaybill["@id"]) {
    const nextContents = contents.filter(
      (waybill) => waybill["@id"] !== waybillId,
    );
    const nextPieceIds = new Set(
      flattenPieces(nextContents).map((piece) => piece["@id"]),
    );
    setContents(nextContents);
    setDgResults(
      dgResults.filter((result) => nextPieceIds.has(result.piece["@id"])),
    );
    setDropRejection(null);
    setSubmitError(null);
  }

  function handleSignOffClick() {
    if (hasRedValidation) {
      setConfirmOverrideOpen(true);
      return;
    }
    void handleSignOff(false);
  }

  async function handleSignOff(override: boolean) {
    if (!uld || !flight) {
      return;
    }

    setConfirmOverrideOpen(false);
    setSigningOff(true);
    setSubmitError(null);

    try {
      const result = signOff(
        {
          ...uld,
          sealNumber: sealNumber.trim(),
        },
        validatedPieces,
        sealNumber.trim(),
        "warehouse-cool-room",
        { allowRejected: override },
      );

      await auditDb.loadings.put(result.loading, result.loading["@id"]);
      await auditDb.events.put(result.event, result.event["@id"]);

      addBuiltUld(
        {
          ...uld,
          sealNumber: sealNumber.trim(),
        },
        contents,
      );
      releaseFromBuildUp(uld["@id"]);

      startMeasurementStreaming(uld.uldSerialNumber, flight.flightNumber);
      router.push(`/flight/${flight.flightNumber}`);
    } catch (error) {
      console.error("Sign-off failed", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Sign-off could not be completed.",
      );
    } finally {
      setSigningOff(false);
    }
  }

  if (dataState.status === "loading") {
    return (
      <MissionShell>
        <main className="px-4 py-6 md:px-6">
          <div className="grid w-full gap-4">
            <MissionPanel>
              <div className="flex min-h-40 items-center justify-center">
                <div className="flex items-center gap-3 text-base text-muted-foreground">
                  <Loader2 className="animate-spin" />
                  Loading build-up canvas…
                </div>
              </div>
            </MissionPanel>
          </div>
        </main>
      </MissionShell>
    );
  }

  if (dataState.status === "error" || !flight || !uld) {
    return (
      <MissionShell>
        <main className="px-4 py-6 md:px-6">
          <div className="grid w-full gap-4">
            <Card className="mission-panel border-red-500/60">
              <CardHeader className="gap-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="text-red-400" />
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">
                      Build-up unavailable
                    </CardTitle>
                    <CardDescription className="text-sm md:text-base">
                      {dataState.status === "error"
                        ? dataState.message
                        : "Flight or ULD fixture was not found."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </main>
      </MissionShell>
    );
  }

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="Load-control bay"
        title={`${flight.flightNumber} / ${uld.uldSerialNumber}`}
        actions={
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => router.push(`/flight/${flight.flightNumber}`)}
          >
            <ArrowLeft data-icon="inline-start" />
            Back to flight
          </Button>
        }
      />
      <main className="grid w-full gap-4 px-4 py-4 md:px-6 xl:h-[calc(100dvh-4rem)] xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:overflow-hidden">
        <section className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
          <MissionHero
            className="min-h-0"
            eyebrow="Build-up canvas"
            title={`Building ${uld.uldSerialNumber}`}
            description={`${getLocationCode(String(flight.departureLocation))} to ${getLocationCode(
              String(flight.arrivalLocation),
            )} on ${flight.flightNumber} · ${getStdLabel(flight)}`}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label="ULD"
                value={uld.uldTypeCode}
                meta={`${uld.ownerCode} · ${uld.serviceabilityCode}`}
              />
              <MetricTile
                label="Pre-cool"
                value={
                  typeof uld.lastKnownInternalC === "number"
                    ? `${uld.lastKnownInternalC.toFixed(1)}°C`
                    : "Pending"
                }
                meta="Internal sensor"
              />
              <MetricTile
                label="Projected ambient"
                value={weather ? weather.airport : "Loading"}
                meta={
                  weather
                    ? `Next ${Math.min(weather.hourly.length, 24)}h · ${weather.source}`
                    : "Weather feed"
                }
              />
            </div>
          </MissionHero>

          <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,0.86fr)_minmax(360px,1.2fr)] xl:overflow-hidden">
            <Card className="mission-panel flex h-full min-h-0 flex-col overflow-hidden border-border/80">
              <CardHeader className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">Manifest</CardTitle>
                    <CardDescription className="text-sm md:text-base">
                      Drag AWBs into the ULD contents area.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="min-h-7">
                    {availableManifest.length} AWBs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-3">
                  {dropRejection ? (
                    <div className="border border-red-500/50 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                      <div className="font-medium">
                        {dropRejection.awbLabel} rejected
                      </div>
                      <div className="mt-1 flex flex-col gap-1 text-red-200">
                        {dropRejection.reasons.map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {availableManifest.length === 0 ? (
                    <div className="border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                      All manifest AWBs are loaded into this ULD or assigned to
                      another built ULD.
                    </div>
                  ) : null}

                  {availableManifest.map((waybill) => {
                    const disabled = checkingDg;
                    const totalAwbWeight = totalWeightKg([waybill]);

                    return (
                      <div
                        key={waybill["@id"]}
                        draggable={!disabled}
                        onDragStart={(event) => handleDragStart(waybill, event)}
                        className={cn(
                          "border border-border/80 bg-muted/30 p-4",
                          disabled && "opacity-50",
                          !disabled && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-base font-semibold">
                              {getWaybillLabel(waybill)}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {waybill.description ?? "No shipment description"}
                            </div>
                          </div>
                          <Badge variant="outline" className="min-h-7 shrink-0">
                            {waybill.shc}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{waybill.pieces.length} pcs</span>
                          <span>{totalAwbWeight.toFixed(0)} kg</span>
                          {waybill.consignor ? (
                            <span>{waybill.consignor}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="mission-panel flex h-full min-h-0 flex-col overflow-hidden border-border/80">
              <CardHeader className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">ULD contents</CardTitle>
                    <CardDescription className="text-sm md:text-base">
                      Native HTML5 drag and drop with immediate rollback on DG
                      rejection.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="min-h-7">
                    {contents.length} AWBs loaded
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);

                    const raw =
                      event.dataTransfer.getData("application/json") ||
                      event.dataTransfer.getData("text/plain");
                    if (!raw) {
                      return;
                    }

                    try {
                      const payload = JSON.parse(raw) as DragPayload;
                      if (typeof payload.waybillId === "string") {
                        void handleDrop(payload);
                      }
                    } catch (error) {
                      console.error("Failed to parse drag payload", error);
                    }
                  }}
                  className={cn(
                    "min-h-72 flex-1 overflow-y-auto border-2 border-dashed border-border bg-muted/30 p-4 transition-colors",
                    dragActive && "border-primary bg-accent/20",
                  )}
                >
                  {contents.length === 0 ? (
                    <div className="flex min-h-[22rem] items-center justify-center text-center text-base text-muted-foreground">
                      Drop AWB cards here to build the ULD.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {contents.map((waybill) => (
                        <div
                          key={waybill["@id"]}
                          className="border border-border/80 bg-background/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-base font-semibold">
                                {getWaybillLabel(waybill)}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {waybill.description ??
                                  "No shipment description"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="min-h-7">
                                {waybill.shc}
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-11"
                                onClick={() =>
                                  handleRemoveWaybill(waybill["@id"])
                                }
                                aria-label={`Remove ${getWaybillLabel(waybill)}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span>{waybill.pieces.length} pcs</span>
                            <span>
                              {totalWeightKg([waybill]).toFixed(0)} kg
                            </span>
                            {waybill.consignor ? (
                              <span>{waybill.consignor}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Total weight
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {totalWeightKg(contents).toFixed(0)} kg
                    </div>
                  </div>
                  <div className="border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Total pieces
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {validatedPieces.length}
                    </div>
                  </div>
                  <div className="border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Ambient source
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {weather?.source ?? "pending"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Card className="mission-panel border-border/80">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-3">
                <PackageCheck className="text-primary" />
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl">Seal and sign off</CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    Sign-off stays locked while any validation card is red.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="seal-number"
                  className="text-sm text-muted-foreground"
                >
                  Seal number
                </label>
                <Input
                  id="seal-number"
                  value={sealNumber}
                  onChange={(event) => setSealNumber(event.target.value)}
                  placeholder="SEAL-2026-001"
                  className="min-h-11"
                />
              </div>

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="inline-flex min-h-11 items-center gap-2 border border-border/70 bg-muted/30 px-3 py-2">
                  <PlaneTakeoff className="size-4" />
                  {getLocationCode(String(flight.departureLocation))}
                </span>
                <span className="inline-flex min-h-11 items-center gap-2 border border-border/70 bg-muted/30 px-3 py-2">
                  <PlaneLanding className="size-4" />
                  {getLocationCode(String(flight.arrivalLocation))}
                </span>
                <span className="inline-flex min-h-11 items-center gap-2 border border-border/70 bg-muted/30 px-3 py-2">
                  <ScanLine className="size-4" />
                  {uld.uldSerialNumber}
                </span>
              </div>

              {weatherError ? (
                <div className="border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                  {weatherError}
                </div>
              ) : null}

              {submitError ? (
                <div className="border border-red-500/50 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                  {submitError}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => router.push(`/flight/${flight.flightNumber}`)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                disabled={signOffDisabled}
                onClick={handleSignOffClick}
              >
                {signingOff ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <PackageCheck />
                )}
                Sign off &amp; seal
              </Button>
            </CardFooter>
          </Card>

          <DgCheckRow
            checking={checkingDg}
            rejection={dropRejection}
            results={dgResults}
            waybills={contents}
          />
          <ShcCompatRow
            conflicts={shcResult.conflicts}
            hasPieces={validatedPieces.length > 0}
            ok={shcResult.ok}
          />
          <BudgetPreflightRow
            forecast={budgetForecast}
            hasPieces={validatedPieces.length > 0}
          />
        </aside>
      </main>
      <Dialog
        open={confirmOverrideOpen}
        onOpenChange={(open) => setConfirmOverrideOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Sign off with failing checks?
            </DialogTitle>
            <DialogDescription>
              At least one validation card is red. Proceeding will record the
              build-up with these issues attached. Use only when overriding is
              authorised by your supervisor.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {dgStatusTone === "red" ? <li>DG validation rejected.</li> : null}
            {shcStatusTone === "red" ? (
              <li>SHC compatibility conflicts present.</li>
            ) : null}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOverrideOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleSignOff(true)}
            >
              Sign off anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MissionShell>
  );
}
