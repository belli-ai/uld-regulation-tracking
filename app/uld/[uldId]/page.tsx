"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ActionCard } from "@/components/action-card";
import {
  MetricTile,
  MissionHero,
  MissionShell,
  MissionTopBar,
  missionCardClassName,
} from "@/components/mission-control";
import { ShcBadge } from "@/components/shc-badge";
import { ThermalBudgetBar } from "@/components/thermal-budget-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import stationsData from "@/public/config/stations.json";
import uldSpecsData from "@/public/config/uld-specs.json";
import airportsData from "@/public/data/airports.json";
import flightsData from "@/public/data/flights.json";
import scenariosData from "@/public/data/scenarios.json";
import shipmentsData from "@/public/data/shipments.json";
import uldInventoryData from "@/public/data/uld-inventory.json";
import { excursionLogger } from "@/lib/audit/excursion-logger";
import type { AirportPolygons } from "@/lib/inference/airport-polygons-loader";
import type {
  LogisticsAction,
  LogisticsEvent,
} from "@/lib/ontology/one-record";
import { auditDb } from "@/lib/persistence/audit-db";
import type { UldPhysicsSpec } from "@/lib/physics/uld-specs-loader";
import { integrateBudget } from "@/lib/physics/pcm-model";
import type {
  Resources,
  StationCapabilities,
  UldContext,
} from "@/lib/recommender/filters";
import { recommendActions, type RankedAction } from "@/lib/recommender/ranker";
import { resolutionLogger } from "@/lib/audit/resolution-logger";
import { parseAirportPolygons } from "@/lib/inference/airport-polygons-loader";
import {
  classifyState,
  getEmittedStateEvents,
} from "@/lib/inference/state-classifier";
import {
  toIRI,
  type Measurement,
  type TemperatureInstructions,
  type TransportMovement,
  type Waybill,
} from "@/lib/ontology/one-record";
import {
  startTrackerFeed,
  type ScenarioParams,
} from "@/lib/simulator/tracker-feed";
import { useFlightsStore } from "@/lib/stores/flights-store";
import { cn } from "@/lib/utils";

const AirportMap = dynamic(
  () => import("@/components/airport-map").then((module) => module.AirportMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

const FlightOverviewMap = dynamic(
  () =>
    import("@/components/flight-overview-map").then(
      (module) => module.FlightOverviewMap,
    ),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

type WeatherSource = "live" | "mock" | null;

type InventoryUld = {
  "@id": string;
  "@type": "ULD";
  uldSerialNumber: string;
  uldTypeCode: string;
  ownerCode: string;
  damageFlag: boolean;
  serviceabilityCode: "SER" | "DAM" | "CON";
  uldProductCode?: string;
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
};

type RawAirport = {
  iata: string;
  name: string;
  latitude: number;
  longitude: number;
};

type RawMovementTime = {
  type?: string;
  timestamp?: string;
};

type RawFlight = TransportMovement & {
  aircraftBody?: string;
  aircraftCategory?: string;
  movementTimes: RawMovementTime[];
};

type Scenario = {
  id: string;
  initial_state?: {
    flights?: string[];
    ulds?: string[];
    weather_override?: {
      ambient_c?: number;
      humidity_pct?: number;
    };
    resources?: {
      cool_dollies_free?: number;
      buildup_bays_free?: number;
    };
  };
  events?: Array<{
    type?: string;
    uldId?: string;
    flightNo?: string;
    flight?: string;
  }>;
};

type UldSpecRecord = {
  productCode: string;
  label: string;
  supportedShc: string[];
  ratedAutonomyHoursAt25C: number;
  pcmMeltRangeC?: {
    min?: number;
    max?: number;
  } | null;
  maxAcceptableInternalC?: number | null;
};

type ClientUldPhysicsSpec = {
  id: string;
  thermalMassKJ_K: number;
  pcmMassKg: number;
  pcmHeatOfFusionKJ_kg: number;
  pcmMeltStart: number;
  pcmMeltEnd: number;
  uValueW_m2K: number;
  surfaceAreaM2: number;
  autonomyHours: number;
};

type HistoryEntry = {
  id: string;
  kind: "excursion" | "resolution" | "transition";
  title: string;
  timestamp: string;
  detail: string;
};

type ChartRow = {
  minute: number;
  label: string;
  internalC: number;
  ambientC: number;
  budgetH: number;
};

const SHC_RANGES: Record<string, { minC: number; maxC: number }> = {
  AVI: { minC: 18, maxC: 26 },
  COL: { minC: 2, maxC: 8 },
  CRT: { minC: 15, maxC: 25 },
  FRO: { minC: -25, maxC: -15 },
  HEG: { minC: 18, maxC: 22 },
  PER: { minC: 2, maxC: 8 },
};

const DEFAULT_CLIENT_SPECS: Record<string, ClientUldPhysicsSpec> = {
  ENVIROTAINER_RAP_COL: {
    id: "ENVIROTAINER_RAP_COL",
    thermalMassKJ_K: 45,
    pcmMassKg: 150,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 2,
    pcmMeltEnd: 8,
    autonomyHours: 96,
    uValueW_m2K: 0.4,
    surfaceAreaM2: 9,
  },
  VA_Q_TAINER_XL: {
    id: "VA_Q_TAINER_XL",
    thermalMassKJ_K: 30,
    pcmMassKg: 60,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 2,
    pcmMeltEnd: 8,
    autonomyHours: 72,
    uValueW_m2K: 0.35,
    surfaceAreaM2: 8,
  },
  SONOCO_PEGASUS_CRT: {
    id: "SONOCO_PEGASUS_CRT",
    thermalMassKJ_K: 25,
    pcmMassKg: 50,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 18,
    pcmMeltEnd: 22,
    autonomyHours: 48,
    uValueW_m2K: 0.5,
    surfaceAreaM2: 7,
  },
  ENVIROTAINER_RKN_FRO: {
    id: "ENVIROTAINER_RKN_FRO",
    thermalMassKJ_K: 50,
    pcmMassKg: 100,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: -25,
    pcmMeltEnd: -18,
    autonomyHours: 120,
    uValueW_m2K: 0.3,
    surfaceAreaM2: 10,
  },
  GENERIC_PASSIVE: {
    id: "GENERIC_PASSIVE",
    thermalMassKJ_K: 15,
    pcmMassKg: 0,
    pcmHeatOfFusionKJ_kg: 0,
    pcmMeltStart: 999,
    pcmMeltEnd: 999,
    autonomyHours: 6,
    uValueW_m2K: 1.5,
    surfaceAreaM2: 6,
  },
  AKH_HORSE_STALL: {
    id: "AKH_HORSE_STALL",
    thermalMassKJ_K: 20,
    pcmMassKg: 0,
    pcmHeatOfFusionKJ_kg: 0,
    pcmMeltStart: 999,
    pcmMeltEnd: 999,
    autonomyHours: 12,
    uValueW_m2K: 1,
    surfaceAreaM2: 12,
  },
};

const inventory = uldInventoryData as InventoryUld[];
const flightsFixture = flightsData as unknown as RawFlight[];
const shipmentsFixture = shipmentsData as unknown as Record<string, Waybill[]>;
const scenarios = (scenariosData as { scenarios: Scenario[] }).scenarios;
const airports = airportsData as Record<string, RawAirport>;
const station = (stationsData as Record<string, StationCapabilities>).DXB;
const uldSpecs = uldSpecsData as Record<string, UldSpecRecord>;

function getCodeFromIri(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.split(":").at(-1) ?? value;
}

function getScenarioForUld(uldId: string): Scenario {
  return (
    scenarios.find((scenario) =>
      scenario.initial_state?.ulds?.includes(uldId),
    ) ??
    scenarios.find((scenario) => scenario.id === "dxb-warehouse-demo") ??
    scenarios[0]
  );
}

function getFlightNumberForUld(
  uldId: string,
  scenario: Scenario,
): string | null {
  const eventMatch = scenario.events?.find((event) => event.uldId === uldId);
  if (typeof eventMatch?.flightNo === "string") {
    return eventMatch.flightNo;
  }
  if (typeof eventMatch?.flight === "string") {
    return eventMatch.flight;
  }

  const scenarioFlights = scenario.initial_state?.flights ?? [];
  const scenarioUlds = scenario.initial_state?.ulds ?? [];
  const index = scenarioUlds.indexOf(uldId);

  if (index >= 0) {
    return scenarioFlights[index] ?? scenarioFlights[0] ?? null;
  }

  return scenarioFlights[0] ?? null;
}

function toTitleCase(value: string | null): string {
  if (value === null) {
    return "—";
  }

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string | Date | null): string {
  if (value === null) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function createMeasurement(
  id: string,
  sensorSuffix: string,
  timestamp: string,
  value: number,
  unit: string,
  geolocation?: { latitude: number; longitude: number },
): Measurement {
  return {
    "@id": toIRI(
      `urn:cool-chain:measurement:${id}:${sensorSuffix}:${timestamp}`,
    ),
    "@type": "Measurement",
    measurementValue: {
      value,
      unit,
    },
    measurementTimestamp: timestamp,
    recordedGeolocation: geolocation,
    bySensor: toIRI(`urn:cool-chain:sensor:${sensorSuffix}`),
  };
}

function getZoneNameFromLocation(location: string | undefined): string | null {
  if (!location) {
    return null;
  }

  return location.split("DXB-").at(1) ?? null;
}

function averageCoordinate(points: Array<[number, number]>) {
  const total = points.reduce(
    (accumulator, [longitude, latitude]) => ({
      latitude: accumulator.latitude + latitude,
      longitude: accumulator.longitude + longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: points.length === 0 ? 25.2532 : total.latitude / points.length,
    longitude: points.length === 0 ? 55.3657 : total.longitude / points.length,
  };
}

function getZoneCenter(
  zoneName: string | null,
  polygons: AirportPolygons | null,
) {
  if (zoneName === null) {
    return { latitude: 25.2532, longitude: 55.3657 };
  }

  if (!polygons) {
    return { latitude: 25.2532, longitude: 55.3657 };
  }

  const zone = polygons.zones[zoneName as keyof typeof polygons.zones];

  if (!zone) {
    return { latitude: 25.2532, longitude: 55.3657 };
  }

  if (zone.kind === "line") {
    return averageCoordinate(zone.coordinates);
  }

  return averageCoordinate(zone.coordinates[0] ?? []);
}

function buildSeedMeasurements(
  uld: InventoryUld,
  scenario: Scenario,
  polygons: AirportPolygons | null,
): Measurement[] {
  const timestamp = new Date().toISOString();
  const zoneCenter = getZoneCenter(
    getZoneNameFromLocation(uld.lastKnownLocation),
    polygons,
  );
  const ambientTemperature =
    scenario.initial_state?.weather_override?.ambient_c ?? 38;
  const internalTemperature = uld.lastKnownInternalC ?? ambientTemperature - 6;

  const measurements = [
    createMeasurement(
      uld.uldSerialNumber,
      "temp",
      timestamp,
      internalTemperature,
      "C",
    ),
    createMeasurement(
      uld.uldSerialNumber,
      "humidity",
      timestamp,
      scenario.initial_state?.weather_override?.humidity_pct ?? 55,
      "pct",
    ),
  ];

  if (uld.iotDeviceId) {
    measurements.push(
      createMeasurement(
        uld.uldSerialNumber,
        "gps",
        timestamp,
        0,
        "km",
        zoneCenter,
      ),
    );
  }

  return measurements;
}

function getTemperatureThreshold(
  uld: InventoryUld,
  waybills: Waybill[],
): TemperatureInstructions {
  const shcCandidates = waybills
    .map((waybill) => waybill.shc)
    .filter((value): value is string => value.length > 0);
  const preferredShc =
    shcCandidates.find((value) =>
      uldSpecs[uld.uldProductCode ?? ""]?.supportedShc.includes(value),
    ) ??
    shcCandidates[0] ??
    uldSpecs[uld.uldProductCode ?? ""]?.supportedShc[0] ??
    "CRT";
  const range = SHC_RANGES[preferredShc] ?? SHC_RANGES.CRT;

  return {
    "@id": toIRI(`urn:cool-chain:threshold:${uld.uldSerialNumber}`),
    "@type": "TemperatureInstructions",
    minTemperature: { value: range.minC, unit: "C" },
    maxTemperature: { value: range.maxC, unit: "C" },
  };
}

function getClientPhysicsSpec(uld: InventoryUld): ClientUldPhysicsSpec {
  const specId = uld.uldProductCode ?? "GENERIC_PASSIVE";
  const fixture = uldSpecs[specId];
  const fallback =
    DEFAULT_CLIENT_SPECS[specId] ?? DEFAULT_CLIENT_SPECS.GENERIC_PASSIVE;

  return {
    id: specId,
    thermalMassKJ_K: fallback.thermalMassKJ_K,
    pcmMassKg: fallback.pcmMassKg,
    pcmHeatOfFusionKJ_kg: fallback.pcmHeatOfFusionKJ_kg,
    pcmMeltStart: fixture?.pcmMeltRangeC?.min ?? fallback.pcmMeltStart,
    pcmMeltEnd: fixture?.pcmMeltRangeC?.max ?? fallback.pcmMeltEnd,
    uValueW_m2K: fallback.uValueW_m2K,
    surfaceAreaM2: fallback.surfaceAreaM2,
    autonomyHours: fixture?.ratedAutonomyHoursAt25C ?? fallback.autonomyHours,
  };
}

function buildAmbientCurve(
  temperatureNow: number,
  ambientStart: number,
  stage: string,
  currentTimestamp: string,
): Measurement[] {
  const baseTime = Date.parse(currentTimestamp) || Date.now();

  return Array.from({ length: 13 }, (_, index) => {
    const stageOffset =
      stage === "in-tarmac"
        ? 4
        : stage === "in-flight"
          ? -6
          : stage === "arrived-tarmac"
            ? 2
            : 0;
    const drift =
      index < 4 ? index * 0.5 : index < 8 ? 2 + index * 0.15 : 3 - index * 0.1;
    const value = ambientStart + stageOffset + drift;

    return createMeasurement(
      "ambient",
      "ambient",
      new Date(baseTime + index * 60 * 60 * 1000).toISOString(),
      index === 0 ? Math.max(value, temperatureNow) : value,
      "C",
    );
  });
}

function getLatestMeasurement(
  measurements: Measurement[],
  sensorUnit: string,
): Measurement | null {
  const match = [...measurements]
    .reverse()
    .find((measurement) => measurement.measurementValue.unit === sensorUnit);

  return match ?? null;
}

function getLatestTemperature(
  measurements: Measurement[],
  fallback: number,
): number {
  return (
    getLatestMeasurement(measurements, "C")?.measurementValue.value ?? fallback
  );
}

function getLatestGeolocation(
  measurements: Measurement[],
  fallback: { latitude: number; longitude: number },
) {
  return (
    [...measurements]
      .reverse()
      .find((measurement) => measurement.recordedGeolocation)
      ?.recordedGeolocation ?? fallback
  );
}

function getFlightProgress(
  flight: TransportMovement | null,
  timestamp: string,
  stage: string,
): number {
  if (flight === null) {
    return 0;
  }

  if (stage === "arrived-tarmac") {
    return 1;
  }

  const departure = flight.movementTimes.find(
    (time) => time.type === "STD",
  )?.timestamp;
  const arrival = flight.movementTimes.find(
    (time) => time.type === "STA",
  )?.timestamp;

  if (!departure || !arrival) {
    return stage === "in-flight" ? 0.5 : 0;
  }

  const nowMs = Date.parse(timestamp);
  const departureMs = Date.parse(departure);
  const arrivalMs = Date.parse(arrival);

  if (
    [nowMs, departureMs, arrivalMs].some(Number.isNaN) ||
    arrivalMs <= departureMs
  ) {
    return stage === "in-flight" ? 0.5 : 0;
  }

  return Math.max(
    0,
    Math.min((nowMs - departureMs) / (arrivalMs - departureMs), 1),
  );
}

function getWeatherBadgeClass(source: WeatherSource) {
  if (source === "live") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (source === "mock") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400";
  }

  return "border-border bg-muted text-muted-foreground";
}

function buildChartRows(
  temperatureNow: number,
  ambientCurve: Measurement[],
  threshold: TemperatureInstructions,
  chartTrace: { t: number; T: number }[],
  autonomyHours: number,
): ChartRow[] {
  return chartTrace.map((point, index) => {
    const ambientPoint =
      ambientCurve[Math.min(index, ambientCurve.length - 1)] ??
      ambientCurve[ambientCurve.length - 1];
    const budgetH = Math.max(autonomyHours - point.t / 3600, 0);

    return {
      minute: point.t / 60,
      label: `${Math.round(point.t / 60)}m`,
      internalC: Number(point.T.toFixed(2)),
      ambientC: ambientPoint?.measurementValue.value ?? temperatureNow,
      budgetH: Number(budgetH.toFixed(2)),
    };
  });
}

function getTopShc(uld: InventoryUld, waybills: Waybill[]): string {
  const compatible = waybills
    .map((waybill) => waybill.shc)
    .filter((shc) =>
      uldSpecs[uld.uldProductCode ?? ""]?.supportedShc.includes(shc),
    );

  return (
    compatible[0] ??
    uldSpecs[uld.uldProductCode ?? ""]?.supportedShc[0] ??
    "CRT"
  );
}

function buildResources(scenario: Scenario): Resources {
  return {
    freeCoolDollies: scenario.initial_state?.resources?.cool_dollies_free ?? 2,
    freeBuildupBays: scenario.initial_state?.resources?.buildup_bays_free ?? 2,
    freeShadingZones: station.policies.shadingZones.length,
    thermalBlanketStock: station.policies.thermalBlanketStock === "Y" ? 8 : 0,
  };
}

function createHistoryEntries(
  events: LogisticsEvent[],
  actions: LogisticsAction[],
  transitions: LogisticsEvent[],
): HistoryEntry[] {
  const excursionEntries: HistoryEntry[] = events.map((event) => ({
    id: event["@id"],
    kind: "excursion",
    title: event.eventName,
    timestamp: event.eventDate,
    detail: event.eventCode,
  }));
  const resolutionEntries: HistoryEntry[] = actions.map((action) => ({
    id: action["@id"],
    kind: "resolution",
    title:
      action.otherIdentifiers
        ?.find((identifier) => identifier.startsWith("actionLabel:"))
        ?.split(":")
        .slice(1)
        .join(":") ?? "Mitigation logged",
    timestamp: action.actionStartTime,
    detail:
      action.otherIdentifiers?.find((identifier) =>
        identifier.startsWith("executor:"),
      ) ?? "executor:handler",
  }));
  const transitionEntries: HistoryEntry[] = transitions.map((event) => ({
    id: event["@id"],
    kind: "transition",
    title: event.eventName,
    timestamp: event.eventDate,
    detail: event.eventCode,
  }));

  return [...excursionEntries, ...resolutionEntries, ...transitionEntries].sort(
    (left, right) => right.timestamp.localeCompare(left.timestamp),
  );
}

export default function UldDetailPage() {
  const params = useParams<{ uldId: string }>();
  const uldId = Array.isArray(params?.uldId)
    ? params.uldId[0]
    : (params?.uldId ?? "");
  const scenario = useMemo(() => getScenarioForUld(uldId), [uldId]);
  const inventoryUld = useMemo(
    () =>
      inventory.find((candidate) => candidate.uldSerialNumber === uldId) ??
      null,
    [uldId],
  );
  const flights = useFlightsStore((state) => state.flights);
  const weatherSource = useFlightsStore((state) => state.weatherSource);
  const loadFlights = useFlightsStore((state) => state.loadFlights);
  const fallbackFlightNumber = getFlightNumberForUld(uldId, scenario);
  const flight = useMemo(() => {
    return (
      flights.find((entry) => entry.flightNumber === fallbackFlightNumber) ??
      flightsFixture.find(
        (entry) => entry.flightNumber === fallbackFlightNumber,
      ) ??
      null
    );
  }, [fallbackFlightNumber, flights]);
  const waybills = useMemo(
    () =>
      fallbackFlightNumber
        ? (shipmentsFixture[fallbackFlightNumber] ?? [])
        : [],
    [fallbackFlightNumber],
  );
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [logicalClockMs, setLogicalClockMs] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [currentExcursionId, setCurrentExcursionId] = useState<string | null>(
    null,
  );
  const [mapGeojson, setMapGeojson] = useState<Record<string, unknown> | null>(
    null,
  );
  const [airportPolygons, setAirportPolygons] =
    useState<AirportPolygons | null>(null);
  const logicalClockRef = useRef(0);

  useEffect(() => {
    if (flights.length === 0) {
      void loadFlights();
    }
  }, [flights.length, loadFlights]);

  useEffect(() => {
    if (!inventoryUld) {
      return;
    }

    setMeasurements(
      buildSeedMeasurements(inventoryUld, scenario, airportPolygons),
    );
    setLogicalClockMs(0);
    logicalClockRef.current = 0;
  }, [airportPolygons, inventoryUld, scenario]);

  useEffect(() => {
    let cancelled = false;

    const loadGeojson = async () => {
      const response = await fetch("/data/airports/DXB.geojson", {
        cache: "no-store",
      });
      if (!response.ok || cancelled) {
        return;
      }

      const json = (await response.json()) as Record<string, unknown>;
      if (cancelled) {
        return;
      }

      setMapGeojson(json);
      setAirportPolygons(parseAirportPolygons(json));
    };

    void loadGeojson();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    logicalClockRef.current = logicalClockMs;
  }, [logicalClockMs]);

  useEffect(() => {
    if (!inventoryUld?.iotDeviceId) {
      return;
    }

    const timer = window.setInterval(() => {
      setLogicalClockMs((previous) => previous + 10 * 60 * 1000);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [inventoryUld?.iotDeviceId]);

  useEffect(() => {
    if (!inventoryUld?.iotDeviceId) {
      return;
    }

    const feed = startTrackerFeed(
      uldId,
      scenario as ScenarioParams,
      () => logicalClockRef.current,
    );

    if (!feed) {
      return;
    }

    const subscription = feed.subscribe((batch) => {
      setMeasurements((previous) => [...previous, ...batch]);
    });

    return () => {
      subscription.unsubscribe();
      feed.stop();
    };
  }, [inventoryUld?.iotDeviceId, scenario, uldId]);

  const fallbackZoneCenter = useMemo(
    () =>
      getZoneCenter(
        getZoneNameFromLocation(inventoryUld?.lastKnownLocation),
        airportPolygons,
      ),
    [airportPolygons, inventoryUld?.lastKnownLocation],
  );
  const classification = useMemo(() => {
    if (!inventoryUld || !airportPolygons) {
      return null;
    }

    return classifyState(uldId, measurements, airportPolygons);
  }, [airportPolygons, inventoryUld, measurements, uldId]);
  const internalTemperature = useMemo(() => {
    return getLatestTemperature(
      measurements,
      inventoryUld?.lastKnownInternalC ?? 20,
    );
  }, [inventoryUld?.lastKnownInternalC, measurements]);
  const latestTimestamp =
    [...measurements].reverse()[0]?.measurementTimestamp ??
    new Date().toISOString();
  const ambientBase = scenario.initial_state?.weather_override?.ambient_c ?? 38;
  const ambientCurve = useMemo(() => {
    return buildAmbientCurve(
      internalTemperature,
      ambientBase,
      classification?.stage ?? "in-warehouse",
      latestTimestamp,
    );
  }, [
    ambientBase,
    classification?.stage,
    internalTemperature,
    latestTimestamp,
  ]);
  const threshold = useMemo(() => {
    return inventoryUld
      ? getTemperatureThreshold(inventoryUld, waybills)
      : null;
  }, [inventoryUld, waybills]);
  const physicsSpec = useMemo(() => {
    return inventoryUld ? getClientPhysicsSpec(inventoryUld) : null;
  }, [inventoryUld]);
  const budgetForecast = useMemo(() => {
    if (!threshold || !physicsSpec) {
      return null;
    }

    const result = integrateBudget(
      physicsSpec as UldPhysicsSpec,
      internalTemperature,
      ambientCurve,
      60,
      threshold,
    );
    const autonomyHours = physicsSpec.autonomyHours;
    const budgetH = result.budgetSec / 3600;
    const warning: "green" | "yellow" | "red" =
      budgetH >= autonomyHours * 0.5
        ? "green"
        : budgetH >= autonomyHours * 0.3
          ? "yellow"
          : "red";

    return {
      budgetH,
      breachAt: result.breachAt?.toISOString() ?? null,
      warning,
      tempTrace: result.tempTrace,
      autonomyHours,
      chartRows: buildChartRows(
        internalTemperature,
        ambientCurve,
        threshold,
        result.tempTrace,
        autonomyHours,
      ),
      maxTemperatureC: threshold.maxTemperature.value,
    };
  }, [ambientCurve, internalTemperature, physicsSpec, threshold]);
  const topShc = useMemo(() => {
    return inventoryUld ? getTopShc(inventoryUld, waybills) : "CRT";
  }, [inventoryUld, waybills]);
  const rankedActions = useMemo(() => {
    if (!inventoryUld || !classification || !budgetForecast) {
      return [];
    }

    const context: UldContext = {
      uldId: inventoryUld["@id"],
      shc: [topShc],
      state: classification.stage,
      timeToBreach: Math.max(Math.round(budgetForecast.budgetH * 60), 1),
    };

    return recommendActions(context, station, buildResources(scenario));
  }, [budgetForecast, classification, inventoryUld, scenario, topShc]);
  const latestPosition = getLatestGeolocation(measurements, fallbackZoneCenter);
  const currentFlightProgress = getFlightProgress(
    flight,
    latestTimestamp,
    classification?.stage ?? "in-warehouse",
  );
  const showFlightOverview =
    classification?.stage === "in-flight" ||
    classification?.stage === "arrived-tarmac";

  useEffect(() => {
    if (!inventoryUld || !budgetForecast || !threshold || !classification) {
      return;
    }

    const locationId =
      classification.stage === "in-flight"
        ? toIRI("urn:cargo:zone:airspace")
        : toIRI(
            `urn:cargo:zone:DXB-${getZoneNameFromLocation(inventoryUld.lastKnownLocation) ?? "unknown"}`,
          );
    const percent = Math.max(
      0,
      Math.min(
        (budgetForecast.budgetH / budgetForecast.autonomyHours) * 100,
        100,
      ),
    );
    const breachInMinutes =
      budgetForecast.breachAt === null
        ? null
        : Math.max(
            (Date.parse(budgetForecast.breachAt) -
              Date.parse(latestTimestamp)) /
              60_000,
            0,
          );
    const event = excursionLogger.detect(
      {
        ambientTemperatureC: ambientBase,
        internalTemperatureC: internalTemperature,
        locationId,
        observedAt: latestTimestamp,
        predictedBreachInMinutes: breachInMinutes,
        state: classification.stage,
        thermalBudgetRemainingPercent: percent,
        uldId: toIRI(inventoryUld["@id"]),
      },
      {
        breachPredictionWindowMinutes: 60,
        maxInternalTemperatureC: threshold.maxTemperature.value,
        warningBudgetPercent: 50,
      },
    );

    if (!event) {
      return;
    }

    setCurrentExcursionId(event["@id"]);
    void auditDb.events.put(event);
  }, [
    ambientBase,
    budgetForecast,
    classification,
    internalTemperature,
    inventoryUld,
    latestTimestamp,
    threshold,
  ]);

  useEffect(() => {
    if (!inventoryUld) {
      return;
    }

    const loadHistory = async () => {
      const allEvents = await auditDb.events.toArray();
      const eventsForUld = allEvents.filter(
        (event) => event.eventFor === inventoryUld["@id"],
      );
      const servedActivityIds = new Set(
        eventsForUld.map((event) => event["@id"]),
      );
      const allActions = await auditDb.actions.toArray();
      const actionsForUld = allActions.filter((action) =>
        action.servedActivity
          ? servedActivityIds.has(action.servedActivity)
          : false,
      );
      setHistory(
        createHistoryEntries(
          eventsForUld,
          actionsForUld,
          getEmittedStateEvents(uldId),
        ),
      );
    };

    void loadHistory();
  }, [inventoryUld, measurements, pendingLabel, uldId]);

  const handleActionLog = async (
    action: RankedAction,
    executor: "handler" | "supervisor" | "ops-control",
  ) => {
    if (!inventoryUld) {
      return;
    }

    const locationId =
      classification?.stage === "in-flight"
        ? toIRI("urn:cargo:zone:airspace")
        : toIRI(
            `urn:cargo:zone:DXB-${getZoneNameFromLocation(inventoryUld.lastKnownLocation) ?? "unknown"}`,
          );
    const excursionEventId = toIRI(
      currentExcursionId ??
        `urn:cool-chain:event:manual:${encodeURIComponent(inventoryUld["@id"])}:${Date.now()}`,
    );

    await resolutionLogger.record(
      {
        actionId: action.id,
        actionLabel: action.label,
        claimedBenefitHours:
          (action.benefitHours[0] + action.benefitHours[1]) / 2,
        excursionEventId,
        locationId,
        startedAt: new Date().toISOString(),
        stationCapability: action.requiresStationCapability[0],
      },
      executor,
      action.executionMinutes * 60,
    );

    setPendingLabel(`${executor}: ${action.label}`);
  };

  if (
    !inventoryUld ||
    !classification ||
    !threshold ||
    !budgetForecast ||
    !mapGeojson
  ) {
    return (
      <MissionShell>
        <main className="flex min-h-screen w-full items-center justify-center px-6 py-8">
          <Card className="mission-panel w-full border">
            <CardHeader>
              <CardTitle className="text-2xl">ULD not found</CardTitle>
              <CardDescription>
                Unable to resolve {uldId || "this detail route"}.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </MissionShell>
    );
  }

  const originAirport =
    airports[getCodeFromIri(flight?.departureLocation) || "DXB"] ??
    airports.DXB;
  const arrivalAirport =
    airports[getCodeFromIri(flight?.arrivalLocation) || "FRA"] ?? airports.FRA;
  const inferenceBadgeClass =
    classification.source === "measured"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="ULD incident command"
        title={inventoryUld.uldSerialNumber}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back</Link>
            </Button>
            <ShcBadge shc={topShc} />
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs font-semibold",
                inferenceBadgeClass,
              )}
            >
              {classification.source === "measured" ? "Measured" : "Inferred"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs font-semibold",
                getWeatherBadgeClass(weatherSource),
              )}
            >
              {weatherSource === "live"
                ? "LIVE"
                : weatherSource === "mock"
                  ? "MOCK"
                  : "WEATHER"}
            </Badge>
          </>
        }
      />

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6">
        <MissionHero
          eyebrow="Thermal risk detail"
          title={inventoryUld.uldSerialNumber}
          description={`${uldSpecs[inventoryUld.uldProductCode ?? ""]?.label ?? "Generic passive"} · ${fallbackFlightNumber ?? "No flight assigned"}`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Current state"
              value={toTitleCase(classification.stage)}
              meta={toTitleCase(classification.internalSubState)}
            />
            <MetricTile
              label="Confidence"
              value={`${Math.round(classification.confidence * 100)}%`}
              meta={classification.source}
            />
            <MetricTile
              label="Internal"
              value={`${internalTemperature.toFixed(1)}°C`}
              meta={`Max ${threshold.maxTemperature.value.toFixed(0)}°C`}
            />
            <MetricTile
              label="Last update"
              value={formatTimestamp(latestTimestamp)}
              meta={
                inventoryUld.iotDeviceId ? "Tracker-equipped" : "Passive ULD"
              }
            />
          </div>
        </MissionHero>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className={cn(missionCardClassName)}>
            <CardHeader>
              <CardTitle className="text-lg">Thermal budget</CardTitle>
              <CardDescription>
                Remaining autonomy against the current ambient projection.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ThermalBudgetBar
                budgetH={budgetForecast.budgetH}
                breachAt={budgetForecast.breachAt}
                warning={budgetForecast.warning}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Flight
                  </p>
                  <p className="pt-1 text-base">
                    {fallbackFlightNumber ?? "Unassigned"}
                  </p>
                </div>
                <div className="border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Pending log
                  </p>
                  <p className="pt-1 text-base">
                    {pendingLabel ?? "No action logged yet"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="mission-panel border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">
                {showFlightOverview ? "Flight overview map" : "Airport map"}
              </CardTitle>
              <CardDescription>
                {showFlightOverview
                  ? "Origin, arrival, and interpolated ULD position along the route."
                  : "DXB sub-zones with the current ULD position inside the station."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[360px] overflow-hidden border border-border bg-muted/20">
                {showFlightOverview ? (
                  <FlightOverviewMap
                    origin={{ code: originAirport.iata, ...originAirport }}
                    arrival={{ code: arrivalAirport.iata, ...arrivalAirport }}
                    flightProgress={currentFlightProgress}
                    label={inventoryUld.uldSerialNumber}
                  />
                ) : (
                  <AirportMap
                    geojson={mapGeojson}
                    position={latestPosition}
                    label={inventoryUld.uldSerialNumber}
                    inferred={!inventoryUld.iotDeviceId}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mission-panel border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">State inference</CardTitle>
              <CardDescription>
                M5 stage classification blended with tracker or passive
                inventory context.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <span className="font-semibold">
                    {toTitleCase(classification.stage)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Sub-state
                  </span>
                  <span className="font-semibold">
                    {toTitleCase(classification.internalSubState)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Confidence
                  </span>
                  <span className="font-semibold">
                    {Math.round(classification.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Position source
                  </span>
                  <span className="font-semibold">
                    {classification.source === "measured"
                      ? "Tracker GPS"
                      : "Zone centre"}
                  </span>
                </div>
              </div>
              <div className="border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Route
                </p>
                <p className="pt-2 text-base">
                  {originAirport.iata} → {arrivalAirport.iata}
                </p>
                <p className="pt-1 text-sm text-muted-foreground">
                  Progress {Math.round(currentFlightProgress * 100)}%
                </p>
              </div>
              <div className="border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Zone / fallback
                </p>
                <p className="pt-2 text-base">
                  {toTitleCase(
                    getZoneNameFromLocation(inventoryUld.lastKnownLocation),
                  )}
                </p>
                <p className="pt-1 text-sm text-muted-foreground">
                  {latestPosition.latitude.toFixed(4)},{" "}
                  {latestPosition.longitude.toFixed(4)}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="mission-panel border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Thermal trace</CardTitle>
              <CardDescription>
                Internal and ambient temperatures with a projected breach
                marker.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={budgetForecast.chartRows}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="temp"
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      yAxisId="budget"
                      orientation="right"
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      yAxisId="temp"
                      y={threshold.maxTemperature.value}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label="Breach line"
                    />
                    {budgetForecast.breachAt ? (
                      <ReferenceLine
                        yAxisId="temp"
                        x={`${Math.round(budgetForecast.budgetH * 60)}m`}
                        stroke="var(--destructive)"
                      />
                    ) : null}
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="internalC"
                      name="Internal °C"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="ambientC"
                      name="Ambient °C"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="budget"
                      type="monotone"
                      dataKey="budgetH"
                      name="Budget h"
                      stroke="var(--muted-foreground)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="mission-panel border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Recommended actions</CardTitle>
                <CardDescription>
                  Top-ranked mitigations from M6 for the current stage and SHC.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {rankedActions.length > 0 ? (
                  rankedActions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onExecute={(selected) =>
                        void handleActionLog(selected, "handler")
                      }
                      onRequest={(selected) =>
                        void handleActionLog(selected, "supervisor")
                      }
                      onEscalate={(selected) =>
                        void handleActionLog(selected, "ops-control")
                      }
                    />
                  ))
                ) : (
                  <div className="border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No viable action at the current state.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Tabs defaultValue="history" className="flex flex-col gap-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="raw">Raw measurements</TabsTrigger>
          </TabsList>
          <TabsContent value="history">
            <Card className="mission-panel border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">History</CardTitle>
                <CardDescription>
                  Linked excursions, mitigations, and transitions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {history.length > 0 ? (
                  history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-1 border border-border bg-muted/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">
                          {entry.title}
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {entry.kind}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {entry.detail}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No linked excursion or resolution history yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="timeline">
            <Card className="mission-panel border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Timeline</CardTitle>
                <CardDescription>
                  M17 will land the full audit timeline surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  This tab is reserved for the linked timeline component.
                </p>
                <Button asChild variant="link" className="px-0">
                  <Link href={`/uld/${inventoryUld.uldSerialNumber}#timeline`}>
                    Open placeholder link
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="raw">
            <Card className="mission-panel border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Raw measurements</CardTitle>
                <CardDescription>
                  Current `Measurement[]` payload from the tracker feed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[360px] overflow-auto border border-border bg-muted/30 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(measurements, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </MissionShell>
  );
}
