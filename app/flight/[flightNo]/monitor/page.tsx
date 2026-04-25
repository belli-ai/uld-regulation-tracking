"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Box,
  CirclePause,
  Clock,
  CloudSun,
  PlaneTakeoff,
  ShieldCheck,
  Snowflake,
  Truck,
} from "lucide-react";

import flightsData from "@/public/data/flights.json";
import shipmentsData from "@/public/data/shipments.json";
import inventoryData from "@/public/data/uld-inventory.json";
import rawWeatherData from "@/public/data/weather/DXB.json";
import {
  MetricTile,
  MissionHero,
  MissionPanel,
  MissionShell,
  MissionTopBar,
} from "@/components/mission-control";
import { ShcBadge } from "@/components/shc-badge";
import { ThermalBudgetBar } from "@/components/thermal-budget-bar";
import { WeatherSourceBadge } from "@/components/weather-source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AmbientReading, CanonicalWeather } from "@/lib/adapters/weather";
import { adaptMockWeather } from "@/lib/adapters/weather";
import type {
  IRI,
  Loading,
  LogisticsAction,
  LogisticsEvent,
  TemperatureInstructions,
  TransportMovement,
  ULD,
  Waybill,
} from "@/lib/ontology/one-record";
import { toIRI } from "@/lib/ontology/one-record";
import { auditDb, type UldThermalSnapshot } from "@/lib/persistence/audit-db";
import shcConfigData from "@/public/config/shc.json";
import {
  computeThermalStatus,
  type ThermalStage,
  type ThermalStatus,
} from "@/lib/physics/thermal-status";
import { useUldStore } from "@/lib/stores/uld-store";

type MonitorStage =
  | "in-warehouse"
  | "in-tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

type StageEventCode =
  | "STATE_WAREHOUSE_IN"
  | "STATE_TARMAC_IN"
  | "STATE_FLIGHT_IN"
  | "STATE_TARMAC_DEST_IN"
  | "STATE_DEST_WAREHOUSE_IN";

type InventoryUld = ULD & {
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
};

type MonitorRow = {
  awbCount: number;
  budgetH: number;
  budgetTone: "green" | "yellow" | "red";
  budgetPercent: number;
  internalC: number;
  ambientC: number;
  effectiveAmbientC: number;
  locationLabel: string;
  shcCodes: string[];
  stage: MonitorStage;
  stageLabel: string;
  trackerLabel: string;
  excursion: ThermalStatus["excursionEventCode"];
  uld: InventoryUld;
};

type AuditSnapshot = {
  events: LogisticsEvent[];
  loadings: Loading[];
};

const flights = flightsData as unknown as TransportMovement[];
const shipmentsByFlight = shipmentsData as unknown as Record<string, Waybill[]>;
const inventory = inventoryData as unknown as InventoryUld[];
const fallbackWeather = adaptMockWeather(rawWeatherData, "DXB");
const DUBAI_TIME_ZONE = "Asia/Dubai";

const STAGE_META: Record<
  MonitorStage,
  {
    eventCode: StageEventCode;
    label: string;
    location: string;
  }
> = {
  "in-warehouse": {
    eventCode: "STATE_WAREHOUSE_IN",
    label: "Warehouse",
    location: "DXB cool room",
  },
  "in-tarmac": {
    eventCode: "STATE_TARMAC_IN",
    label: "Tarmac",
    location: "DXB apron staging",
  },
  "in-flight": {
    eventCode: "STATE_FLIGHT_IN",
    label: "In flight",
    location: "Aircraft hold",
  },
  "arrived-tarmac": {
    eventCode: "STATE_TARMAC_DEST_IN",
    label: "Arrived tarmac",
    location: "Destination apron",
  },
  "arrived-destination": {
    eventCode: "STATE_DEST_WAREHOUSE_IN",
    label: "Destination",
    location: "Destination warehouse",
  },
};

type RawShcEntry = {
  temperatureInstructions?: {
    minTemperature?: { value?: unknown; unit?: unknown };
    maxTemperature?: { value?: unknown; unit?: unknown };
  };
};

const SHC_CONFIG = shcConfigData as {
  default?: RawShcEntry;
  shc?: Record<string, RawShcEntry>;
};

function getThresholdInstructions(shcCode: string): TemperatureInstructions {
  const shcEntry = SHC_CONFIG.shc?.[shcCode] ?? SHC_CONFIG.default;
  const minValue = shcEntry?.temperatureInstructions?.minTemperature?.value;
  const maxValue = shcEntry?.temperatureInstructions?.maxTemperature?.value;
  const minUnit = shcEntry?.temperatureInstructions?.minTemperature?.unit;
  const maxUnit = shcEntry?.temperatureInstructions?.maxTemperature?.unit;

  return {
    "@id": toIRI(`urn:cargo:tempinstr:${shcCode}`),
    "@type": "TemperatureInstructions",
    minTemperature: {
      unit: minUnit === "F" ? "F" : "C",
      value: typeof minValue === "number" ? minValue : 15,
    },
    maxTemperature: {
      unit: maxUnit === "F" ? "F" : "C",
      value: typeof maxValue === "number" ? maxValue : 25,
    },
  };
}

function getDominantShc(waybills: Waybill[]): string {
  const seen = new Map<string, number>();
  for (const waybill of waybills) {
    const code = waybill.shc;
    if (!code) continue;
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }
  if (seen.size === 0) return "GEN";
  let bestCode = "GEN";
  let bestCount = -1;
  for (const [code, count] of seen) {
    if (count > bestCount) {
      bestCode = code;
      bestCount = count;
    }
  }
  return bestCode;
}

const STAGE_BY_EVENT: Partial<Record<string, MonitorStage>> = {
  BUILD_UP_COMPLETE: "in-warehouse",
  STATE_DEST_WAREHOUSE_IN: "arrived-destination",
  STATE_FLIGHT_IN: "in-flight",
  STATE_TARMAC_DEST_IN: "arrived-tarmac",
  STATE_TARMAC_IN: "in-tarmac",
  STATE_WAREHOUSE_IN: "in-warehouse",
};

function formatLocation(iri: string | undefined) {
  if (!iri) {
    return "TBD";
  }
  return iri.split(":").at(-1) ?? iri;
}

function formatFlightTime(flight: TransportMovement | null) {
  const std = flight?.movementTimes.find((time) => time.type === "STD");
  if (!std?.timestamp) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(std.timestamp));
}

function formatDubaiTime(timeMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    timeZone: DUBAI_TIME_ZONE,
  }).format(new Date(timeMs));
}

function formatDubaiDate(timeMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: DUBAI_TIME_ZONE,
  }).format(new Date(timeMs));
}

function readWeatherTimeMs(reading: AmbientReading): number | null {
  const parsed = Date.parse(reading.timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentWeather(
  weather: CanonicalWeather,
  timeMs: number,
): AmbientReading | null {
  const sorted = weather.hourly
    .map((reading) => ({ reading, timeMs: readWeatherTimeMs(reading) }))
    .filter(
      (entry): entry is { reading: AmbientReading; timeMs: number } =>
        entry.timeMs !== null,
    )
    .sort((left, right) => left.timeMs - right.timeMs);

  if (sorted.length === 0) {
    return null;
  }

  const latestPast = [...sorted]
    .reverse()
    .find((entry) => entry.timeMs <= timeMs);

  return (latestPast ?? sorted[0]).reading;
}

function getWeatherPrediction(
  weather: CanonicalWeather,
  timeMs: number,
): AmbientReading[] {
  const future = weather.hourly
    .filter((reading) => {
      const readingTimeMs = readWeatherTimeMs(reading);
      return readingTimeMs !== null && readingTimeMs >= timeMs;
    })
    .slice(0, 5);

  return future.length > 0 ? future : weather.hourly.slice(0, 5);
}

function formatPredictionTime(reading: AmbientReading): string {
  const timeMs = readWeatherTimeMs(reading);
  if (timeMs === null) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: DUBAI_TIME_ZONE,
  }).format(new Date(timeMs));
}

function asUldSerial(value: string): string {
  return value.split(":").at(-1) ?? value;
}

function getStorageKey(flightNo: string): string {
  return `cool-chain:flight-monitor:${flightNo}`;
}

function isMonitorStage(value: unknown): value is MonitorStage {
  return typeof value === "string" && value in STAGE_META;
}

function readStoredStages(flightNo: string): Record<string, MonitorStage> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(getStorageKey(flightNo));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") {
      return {};
    }

    const stages: Record<string, MonitorStage> = {};
    for (const [uldSerialNumber, stage] of Object.entries(parsed)) {
      if (isMonitorStage(stage)) {
        stages[uldSerialNumber] = stage;
      }
    }
    return stages;
  } catch (error) {
    console.error("Failed to read monitor state", error);
    return {};
  }
}

function writeStoredStages(
  flightNo: string,
  stages: Record<string, MonitorStage>,
): void {
  try {
    sessionStorage.setItem(getStorageKey(flightNo), JSON.stringify(stages));
  } catch (error) {
    console.error("Failed to store monitor state", error);
  }
}

function latestStageFromAudit(
  uld: ULD,
  events: LogisticsEvent[],
): MonitorStage {
  const latestEvent = events
    .filter(
      (event) => asUldSerial(String(event.eventFor)) === uld.uldSerialNumber,
    )
    .sort(
      (left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate),
    )
    .find((event) => STAGE_BY_EVENT[event.eventCode]);

  return latestEvent
    ? (STAGE_BY_EVENT[latestEvent.eventCode] ?? "in-warehouse")
    : "in-warehouse";
}

function createFlightMaps(flightShipments: Waybill[]) {
  const waybillIds = new Set(flightShipments.map((waybill) => waybill["@id"]));
  const waybillByPiece = new Map<IRI, Waybill>();

  for (const waybill of flightShipments) {
    for (const piece of waybill.pieces) {
      waybillByPiece.set(piece["@id"], waybill);
    }
  }

  return { waybillByPiece, waybillIds };
}

function getShcCodes(waybills: Waybill[]): string[] {
  const codes = Array.from(
    new Set(waybills.map((waybill) => waybill.shc).filter(Boolean)),
  ).sort();

  return codes.length > 0 ? codes : ["GEN"];
}

function buildRowsFromStore(
  builtUlds: ULD[],
  builtContents: Record<string, Waybill[]>,
  waybillIds: Set<IRI>,
): Array<{ contents: Waybill[]; uld: InventoryUld }> {
  return builtUlds.flatMap((uld) => {
    const contents = builtContents[uld["@id"]] ?? [];
    const flightContents = contents.filter((waybill) =>
      waybillIds.has(waybill["@id"]),
    );

    if (flightContents.length === 0) {
      return [];
    }

    const inventoryEntry =
      inventory.find((candidate) => candidate["@id"] === uld["@id"]) ?? uld;

    return [{ contents: flightContents, uld: inventoryEntry as InventoryUld }];
  });
}

function buildRowsFromAudit(
  loadings: Loading[],
  waybillByPiece: Map<IRI, Waybill>,
): Array<{ contents: Waybill[]; uld: InventoryUld }> {
  return loadings.flatMap((loading) => {
    const uldIri = loading.loadedUnits[0];
    if (!uldIri) {
      return [];
    }

    const contentsById = new Map<IRI, Waybill>();
    for (const pieceIri of loading.loadedPieces) {
      const waybill = waybillByPiece.get(pieceIri);
      if (waybill) {
        contentsById.set(waybill["@id"], waybill);
      }
    }

    if (contentsById.size === 0) {
      return [];
    }

    const uld = inventory.find((candidate) => candidate["@id"] === uldIri);
    if (!uld) {
      return [];
    }

    return [{ contents: Array.from(contentsById.values()), uld }];
  });
}

function createMonitorRows(
  rowInputs: Array<{ contents: Waybill[]; uld: InventoryUld }>,
  stageByUld: Record<string, MonitorStage>,
  events: LogisticsEvent[],
  weather: CanonicalWeather,
  logicalNowMs: number,
): MonitorRow[] {
  const uniqueRows = new Map<
    string,
    { contents: Waybill[]; uld: InventoryUld }
  >();

  for (const input of rowInputs) {
    uniqueRows.set(input.uld.uldSerialNumber, input);
  }

  return Array.from(uniqueRows.values()).map(({ contents, uld }) => {
    const stage =
      stageByUld[uld.uldSerialNumber] ?? latestStageFromAudit(uld, events);
    const meta = STAGE_META[stage];
    const dominantShc = getDominantShc(contents);
    const threshold = getThresholdInstructions(dominantShc);

    const thermal = computeThermalStatus({
      uld,
      shcCode: dominantShc,
      threshold,
      weather,
      stage: stage as ThermalStage,
      logicalNowMs,
      locationId: toIRI(`urn:cargo:zone:DXB-${stage}`),
    });

    return {
      awbCount: contents.length,
      budgetH: thermal.budgetH,
      budgetTone: thermal.budgetTone,
      budgetPercent: thermal.budgetPercent,
      internalC: thermal.internalC,
      ambientC: thermal.ambientC,
      effectiveAmbientC: thermal.effectiveAmbientC,
      locationLabel: meta.location,
      shcCodes: getShcCodes(contents),
      stage,
      stageLabel: meta.label,
      trackerLabel: uld.iotDeviceId ? `${uld.iotDeviceId} online` : "Inferred",
      excursion: thermal.excursionEventCode,
      uld,
    };
  });
}

function createEventId(
  eventCode: StageEventCode,
  uldSerialNumber: string,
  timestamp: string,
): IRI {
  return toIRI(
    `urn:cool-chain:monitor-event:${eventCode}:${encodeURIComponent(
      uldSerialNumber,
    )}:${encodeURIComponent(timestamp)}`,
  );
}

function createActionId(
  actionId: string,
  uldSerialNumber: string,
  timestamp: string,
): IRI {
  return toIRI(
    `urn:cool-chain:monitor-action:${actionId}:${encodeURIComponent(
      uldSerialNumber,
    )}:${encodeURIComponent(timestamp)}`,
  );
}

function getEventLocation(
  stage: MonitorStage,
  flight: TransportMovement | null,
): IRI {
  if (stage === "in-flight" && flight) {
    return flight["@id"];
  }

  if (stage === "in-tarmac") {
    return toIRI("urn:cargo:zone:DXB-apron-staging");
  }

  return toIRI("urn:cargo:zone:DXB-cool-room");
}

export default function FlightMonitorPage() {
  const params = useParams<{ flightNo: string }>();
  const router = useRouter();
  const flightNo = typeof params.flightNo === "string" ? params.flightNo : "";
  const builtUlds = useUldStore((state) => state.ulds);
  const builtContents = useUldStore((state) => state.contents);
  const [auditSnapshot, setAuditSnapshot] = useState<AuditSnapshot>({
    events: [],
    loadings: [],
  });
  const [stageByUld, setStageByUld] = useState<Record<string, MonitorStage>>(
    {},
  );
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [weather, setWeather] = useState<CanonicalWeather>(fallbackWeather);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  const flight =
    flights.find((candidate) => candidate.flightNumber === flightNo) ?? null;
  const route = `${formatLocation(flight?.departureLocation)}→${formatLocation(
    flight?.arrivalLocation,
  )}`;
  const flightShipments = shipmentsByFlight[flightNo] ?? [];
  const { waybillByPiece, waybillIds } = useMemo(
    () => createFlightMaps(flightShipments),
    [flightShipments],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateAudit() {
      setIsLoadingAudit(true);

      try {
        const [events, loadings] = await Promise.all([
          auditDb.events.toArray(),
          auditDb.loadings.toArray(),
        ]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setAuditSnapshot({ events, loadings });
          setStageByUld(readStoredStages(flightNo));
          setIsLoadingAudit(false);
        });
      } catch (error) {
        console.error("Flight monitor audit load failed", error);
        if (!cancelled) {
          setIsLoadingAudit(false);
        }
      }
    }

    void hydrateAudit();

    return () => {
      cancelled = true;
    };
  }, [flightNo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setIsLoadingWeather(true);

      try {
        const response = await fetch("/api/weather?airport=DXB", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Weather returned ${response.status}`);
        }

        const payload = (await response.json()) as CanonicalWeather;
        if (!cancelled) {
          setWeather(payload);
        }
      } catch (error) {
        console.error("Flight monitor weather load failed", error);
        if (!cancelled) {
          setWeather(fallbackWeather);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWeather(false);
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, []);

  const rowInputs = [
    ...buildRowsFromStore(builtUlds, builtContents, waybillIds),
    ...buildRowsFromAudit(auditSnapshot.loadings, waybillByPiece),
  ];
  const liveSnapshots =
    useLiveQuery(
      () => auditDb.uldStatus.toArray(),
      [],
      [] as UldThermalSnapshot[],
    ) ?? [];
  const snapshotByUld = new Map(
    liveSnapshots.map((snap) => [snap.uldId, snap] as const),
  );
  const localRows = createMonitorRows(
    rowInputs,
    stageByUld,
    auditSnapshot.events,
    weather,
    currentTimeMs,
  );
  const rows: MonitorRow[] = localRows.map((row) => {
    const snap = snapshotByUld.get(row.uld.uldSerialNumber);
    if (!snap) return row;
    const overlaid: MonitorRow = {
      ...row,
      ambientC: snap.ambientC,
      effectiveAmbientC: snap.effectiveAmbientC,
      budgetH: snap.budgetH,
      budgetPercent: snap.budgetPercent,
      budgetTone: snap.budgetTone,
      internalC: snap.internalC,
      stage: snap.stage as MonitorStage,
      stageLabel:
        STAGE_META[snap.stage as MonitorStage]?.label ?? row.stageLabel,
      locationLabel:
        STAGE_META[snap.stage as MonitorStage]?.location ?? row.locationLabel,
    };
    return overlaid;
  });
  const assignedAwbIds = new Set<IRI>();

  rows.forEach((row) => {
    const input = rowInputs.find(
      (candidate) => candidate.uld.uldSerialNumber === row.uld.uldSerialNumber,
    );
    input?.contents.forEach((waybill) => assignedAwbIds.add(waybill["@id"]));
  });

  const openAwbCount = Math.max(
    0,
    flightShipments.length - assignedAwbIds.size,
  );
  const tarmacCount = rows.filter((row) => row.stage === "in-tarmac").length;
  const loadedCount = rows.filter((row) => row.stage === "in-flight").length;
  const currentWeather = getCurrentWeather(weather, currentTimeMs);
  const weatherPrediction = getWeatherPrediction(weather, currentTimeMs);

  async function recordStage(row: MonitorRow, nextStage: MonitorStage) {
    const timestamp = new Date().toISOString();
    const meta = STAGE_META[nextStage];
    const event: LogisticsEvent = {
      "@id": createEventId(meta.eventCode, row.uld.uldSerialNumber, timestamp),
      "@type": "LogisticsEvent",
      eventCode: meta.eventCode,
      eventName: meta.label,
      eventDate: timestamp,
      eventFor: row.uld["@id"],
      eventLocation: getEventLocation(nextStage, flight),
      eventTimeType: "actual",
    };

    setStageByUld((current) => {
      const next = {
        ...current,
        [row.uld.uldSerialNumber]: nextStage,
      };
      writeStoredStages(flightNo, next);
      return next;
    });
    setOperationMessage(`${row.uld.uldSerialNumber}: ${meta.label}`);

    try {
      await auditDb.events.put(event, event["@id"]);
      setAuditSnapshot((current) => ({
        ...current,
        events: [...current.events, event],
      }));
    } catch (error) {
      console.error("Failed to record monitor state event", error);
      setOperationMessage(
        `${row.uld.uldSerialNumber}: ${meta.label} (audit pending)`,
      );
    }
  }

  async function recordAction(
    row: MonitorRow,
    actionId: string,
    label: string,
  ) {
    const timestamp = new Date().toISOString();
    const action: LogisticsAction = {
      "@id": createActionId(actionId, row.uld.uldSerialNumber, timestamp),
      "@type": "LogisticsAction",
      actionStartTime: timestamp,
      actionEndTime: timestamp,
      performedAt: getEventLocation(row.stage, flight),
      otherIdentifiers: [
        `actionLabel:${label}`,
        `flight:${flightNo}`,
        `stage:${row.stage}`,
        `uld:${row.uld.uldSerialNumber}`,
      ],
    };

    setOperationMessage(`${row.uld.uldSerialNumber}: ${label}`);

    try {
      await auditDb.actions.put(action, action["@id"]);
    } catch (error) {
      console.error("Failed to record monitor action", error);
      setOperationMessage(
        `${row.uld.uldSerialNumber}: ${label} (audit pending)`,
      );
    }
  }

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="Flight monitoring"
        title={flightNo}
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/flight/${encodeURIComponent(flightNo)}`}>
                <ArrowLeft data-icon="inline-start" />
                Workspace
              </Link>
            </Button>
            <Badge variant="secondary">{route}</Badge>
            <Badge variant="outline">ETD {formatFlightTime(flight)}</Badge>
            <Badge variant="outline">
              DXB {formatDubaiTime(currentTimeMs)}
            </Badge>
          </>
        }
      />

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-5">
          <MissionHero
            eyebrow="Release control"
            title="Flight monitoring"
            description="Monitor built ULD location state, thermal budget, and explicit release actions for this outbound flight."
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <MetricTile
                label="Built ULDs"
                value={rows.length}
                meta="Tracked"
              />
              <MetricTile label="Tarmac" value={tarmacCount} meta="Released" />
              <MetricTile label="Loaded" value={loadedCount} meta="In flight" />
              <MetricTile
                label="Open AWBs"
                value={openAwbCount}
                meta="Build-up"
              />
            </div>
          </MissionHero>

          <MissionPanel
            title="ULD monitor"
            description="Dispatch from warehouse, mark aircraft loading, or request station actions."
            contentClassName="flex flex-col gap-3"
          >
            {rows.length === 0 ? (
              <div className="flex flex-col gap-4 border border-dashed border-border p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">
                    No signed-off ULDs
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Build or sign off a ULD before starting flight monitoring.
                  </p>
                </div>
                <Button
                  className="w-fit"
                  onClick={() =>
                    router.push(`/flight/${encodeURIComponent(flightNo)}`)
                  }
                  variant="outline"
                >
                  <ArrowLeft data-icon="inline-start" />
                  Workspace
                </Button>
              </div>
            ) : null}

            {rows.map((row) => (
              <div
                key={row.uld.uldSerialNumber}
                className="grid gap-4 border border-border/70 bg-background/40 p-4 lg:grid-cols-[minmax(220px,0.72fr)_minmax(220px,0.58fr)_minmax(260px,0.7fr)]"
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold">
                      {row.uld.uldSerialNumber}
                    </span>
                    {row.shcCodes.map((code) => (
                      <ShcBadge key={code} shc={code} />
                    ))}
                    <Badge variant="outline">{row.awbCount} AWBs</Badge>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>{row.uld.uldTypeCode}</span>
                    <span>{row.trackerLabel}</span>
                    <span>Internal {row.internalC.toFixed(1)}C</span>
                    <span>
                      Ambient {row.effectiveAmbientC.toFixed(1)}C
                      {Math.abs(row.ambientC - row.effectiveAmbientC) > 0.5
                        ? ` (raw ${row.ambientC.toFixed(1)}C)`
                        : ""}
                    </span>
                    <span>{row.locationLabel}</span>
                    <span>
                      Budget {row.budgetH.toFixed(1)}h ·{" "}
                      {row.budgetPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Current state
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{row.stageLabel}</Badge>
                    {row.stage === "in-warehouse" ? (
                      <Badge variant="outline">Ready for release</Badge>
                    ) : null}
                    {row.stage === "in-tarmac" ? (
                      <Badge variant="outline">Awaiting load</Badge>
                    ) : null}
                    {row.excursion === "BREACH_ACTUAL" ? (
                      <Badge variant="destructive">Excursion</Badge>
                    ) : row.excursion === "BREACH_PREDICTED" ? (
                      <Badge variant="destructive">Breach predicted</Badge>
                    ) : row.excursion === "WARNING_BUDGET_LOW" ? (
                      <Badge variant="outline">Budget low</Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.stage === "in-warehouse" ? (
                      <Button
                        size="sm"
                        onClick={() => void recordStage(row, "in-tarmac")}
                      >
                        <Truck data-icon="inline-start" />
                        Dispatch
                      </Button>
                    ) : null}
                    {row.stage === "in-tarmac" ? (
                      <Button
                        size="sm"
                        onClick={() => void recordStage(row, "in-flight")}
                      >
                        <PlaneTakeoff data-icon="inline-start" />
                        Loaded
                      </Button>
                    ) : null}
                    {row.stage === "in-warehouse" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void recordAction(
                            row,
                            "hold-cool-room",
                            "Hold in cool room",
                          )
                        }
                      >
                        <CirclePause data-icon="inline-start" />
                        Hold
                      </Button>
                    ) : null}
                    {row.stage !== "in-flight" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void recordAction(
                            row,
                            "cool-dolly",
                            "Request cool dolly",
                          )
                        }
                      >
                        <Snowflake data-icon="inline-start" />
                        Cool dolly
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/uld/${encodeURIComponent(row.uld.uldSerialNumber)}`}
                      >
                        <Box data-icon="inline-start" />
                        Detail
                      </Link>
                    </Button>
                  </div>
                </div>

                <ThermalBudgetBar
                  breachAt={null}
                  budgetH={row.budgetH}
                  warning={row.budgetTone}
                />
              </div>
            ))}
          </MissionPanel>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <MetricTile
            label="DXB time"
            value={formatDubaiTime(currentTimeMs)}
            meta={formatDubaiDate(currentTimeMs)}
          />

          <Card className="mission-panel border-border/80">
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-lg">Weather</CardTitle>
                  <CardDescription>DXB ramp now and forecast.</CardDescription>
                </div>
                <WeatherSourceBadge source={weather.source} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <CloudSun data-icon="inline-start" />
                    Current
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-foreground">
                    {currentWeather
                      ? `${currentWeather.ambientC.toFixed(1)}C`
                      : "--.-C"}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {typeof currentWeather?.humidityPct === "number"
                      ? `${currentWeather.humidityPct.toFixed(0)}% humidity`
                      : "Humidity unavailable"}
                  </p>
                </div>
                <div className="border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Clock data-icon="inline-start" />
                    Feed
                  </div>
                  <div className="mt-2 font-mono text-base font-semibold text-foreground">
                    {isLoadingWeather ? "Refreshing" : "Ready"}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generated{" "}
                    {formatPredictionTime({
                      ambientC: 0,
                      timestamp: weather.generatedAt,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Prediction
                </div>
                {weatherPrediction.map((reading) => (
                  <div
                    key={`${reading.timestamp}-${reading.ambientC}`}
                    className="flex items-center justify-between gap-3 border border-border/60 bg-background/30 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-muted-foreground">
                      {formatPredictionTime(reading)}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {reading.ambientC.toFixed(1)}C
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mission-panel border-border/80">
            <CardHeader className="gap-2">
              <CardTitle className="text-lg">Release checklist</CardTitle>
              <CardDescription>
                Operational handoff after flight build-up.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck data-icon="inline-start" />
                Tracker monitoring active
              </div>
              <div className="flex items-center gap-2">
                <Truck data-icon="inline-start" />
                Dispatch to tarmac when release window opens
              </div>
              <div className="flex items-center gap-2">
                <PlaneTakeoff data-icon="inline-start" />
                Mark loaded after aircraft handoff
              </div>
              {operationMessage ? (
                <div className="border border-primary/40 bg-primary/5 p-3 text-foreground">
                  {operationMessage}
                </div>
              ) : null}
              <div className="font-mono text-xs">
                {isLoadingAudit
                  ? "Loading audit state..."
                  : "Audit state ready"}
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </MissionShell>
  );
}
