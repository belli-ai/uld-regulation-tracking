"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import flightsData from "@/public/data/flights.json";
import rawScenariosData from "@/public/data/scenarios.json";
import rawUldSpecsData from "@/public/config/uld-specs.json";
import rawShcConfigData from "@/public/config/shc.json";
import rawWeatherData from "@/public/data/weather/DXB.json";
import rawInventoryData from "@/public/data/uld-inventory.json";
import { OneConnectBadge } from "@/components/one-connect-badge";
import {
  PushTimeCard,
  type PushTimeCardData,
} from "@/components/push-time-card";
import {
  MetricTile,
  MissionHero,
  MissionPanel,
  MissionShell,
  MissionTopBar,
} from "@/components/mission-control";
import {
  UldTrackerTable,
  type TrackerStage,
  type TrackerStatus,
  type UldTrackerRow,
} from "@/components/uld-tracker-table";
import { WeatherSourceBadge } from "@/components/weather-source-badge";
import { WeatherPanel } from "@/components/weather-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adaptMockFlights } from "@/lib/adapters/flights";
import { adaptMockUldInventory } from "@/lib/adapters/uld-inventory";
import {
  adaptMockWeather,
  type CanonicalWeather,
} from "@/lib/adapters/weather";
import {
  classifyState,
  resetStateClassifier,
} from "@/lib/inference/state-classifier";
import {
  loadAirportPolygons,
  type AirportPolygons,
} from "@/lib/inference/airport-polygons-loader";
import {
  toIRI,
  type Loading,
  type LogisticsAction,
  type LogisticsEvent,
  type Measurement,
  type TemperatureInstructions,
  type TransportMovement,
  type ULD,
} from "@/lib/ontology/one-record";
import { auditDb, type UldThermalSnapshot } from "@/lib/persistence/audit-db";
import {
  computeThermalStatus,
  type ThermalStage,
} from "@/lib/physics/thermal-status";
import { startTrackerFeed } from "@/lib/simulator/tracker-feed";
import { cn } from "@/lib/utils";

type WeatherSource = "live" | "mock";

type AuditSnapshot = {
  actions: LogisticsAction[];
  events: LogisticsEvent[];
  loadings: Loading[];
};

type InventoryRecord = ULD & {
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
  uldProductCode?: string;
};

type UldSpecRecord = {
  label?: unknown;
  productCode?: unknown;
  ratedAutonomyHoursAt25C?: unknown;
  supportedShc?: unknown;
};

type RawScenario = {
  id?: unknown;
  initial_state?: {
    flights?: unknown;
    ulds?: unknown;
  };
};

type RawShcEntry = {
  temperatureInstructions?: {
    minTemperature?: { value?: unknown; unit?: unknown };
    maxTemperature?: { value?: unknown; unit?: unknown };
  };
  maxWaitMinutes?: Record<string, unknown>;
};

type TrackerMeasurementsByUld = Record<string, Measurement[]>;

type SchedulerSnapshot = {
  holdDecision: "HOLD" | "PUSH";
  maxWaitAirMinutes: number;
  pushTimeLabel: string;
  reason: string;
};

const DXB_STATION = "DXB";
const DUBAI_TIME_ZONE = "Asia/Dubai";
const RESOURCE_FALLBACK = {
  freeCoolDollies: 8,
  freeCoolRoomSlots: 200,
};
const LOGICAL_MULTIPLIER = 60;
const TRACKER_WINDOW = 48;
const TOW_ESTIMATE_MINUTES: Record<string, number> = {
  AVI: 5,
  PER: 12,
  COL: 18,
  CRT: 25,
  FRO: 20,
  HEG: 6,
  default: 20,
};
const FALLBACK_EXPOSURE_RATIO: Record<string, number> = {
  AVI: 0.2,
  PER: 0.3,
  COL: 0.55,
  CRT: 0.82,
  FRO: 0.72,
  HEG: 0.24,
  default: 0.64,
};
const ULD_SHC_OVERRIDES: Record<string, string> = {
  "AAU-66610EK": "CRT",
  "AKE-12345EK": "COL",
  "AKE-22219EK": "COL",
  "AKH-77701EK": "AVI",
  "AKH-77702EK": "AVI",
  "AKW-44401EK": "COL",
  "AAY-55501EK": "HEG",
  "RKN-99001EK": "PER",
  "RKN-99002EK": "FRO",
};
const defaultWeather = adaptMockWeather(rawWeatherData as unknown, DXB_STATION);
const fallbackFlights = adaptMockFlights(flightsData as unknown);
const fallbackInventory = adaptMockUldInventory(rawInventoryData as unknown);
const inventoryById = buildInventoryById();
const fallbackScenario = getFallbackScenario();
const fallbackBuiltUldIds = getFallbackBuiltUldIds();
const fallbackFlightMap = buildFallbackFlightMap();
const simulationBaseMs = getSimulationBaseMs();

function buildInventoryById(): Record<string, InventoryRecord> {
  const byId: Record<string, InventoryRecord> = {};
  const canonicalInventory = fallbackInventory;
  const rawInventory = Array.isArray(rawInventoryData) ? rawInventoryData : [];

  canonicalInventory.forEach((uld, index) => {
    const rawEntry = rawInventory[index] as
      | Partial<InventoryRecord>
      | undefined;
    byId[uld.uldSerialNumber] = {
      ...uld,
      iotDeviceId:
        typeof rawEntry?.iotDeviceId === "string"
          ? rawEntry.iotDeviceId
          : undefined,
      lastKnownInternalC:
        typeof rawEntry?.lastKnownInternalC === "number"
          ? rawEntry.lastKnownInternalC
          : undefined,
      lastKnownLocation:
        typeof rawEntry?.lastKnownLocation === "string"
          ? rawEntry.lastKnownLocation
          : undefined,
      uldProductCode:
        typeof rawEntry?.uldProductCode === "string"
          ? rawEntry.uldProductCode
          : undefined,
    };
  });

  return byId;
}

function getFallbackScenario(): RawScenario | null {
  const scenarios = ((rawScenariosData as { scenarios?: unknown }).scenarios ??
    []) as RawScenario[];
  return (
    scenarios.find((scenario) => scenario.id === "dxb-cascading-delays") ?? null
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function getFallbackBuiltUldIds(): string[] {
  return readStringArray(fallbackScenario?.initial_state?.ulds);
}

function buildFallbackFlightMap(): Record<string, string> {
  const flights = readStringArray(fallbackScenario?.initial_state?.flights);
  const flightMap: Record<string, string> = {};

  fallbackBuiltUldIds.forEach((uldId, index) => {
    if (flights.length === 0) {
      return;
    }

    flightMap[uldId] = flights[index % flights.length] ?? flights[0];
  });

  return flightMap;
}

function getSimulationBaseMs(): number {
  const firstStd = Math.min(
    ...fallbackFlights
      .map((flight) => getFlightStdMs(flight))
      .filter((value): value is number => value !== null),
  );

  return Number.isFinite(firstStd) ? firstStd - 2 * 60 * 60 * 1000 : Date.now();
}

function getFlightStdMs(flight: TransportMovement): number | null {
  const stdTimestamp = flight.movementTimes.find(
    (entry) => entry.type === "STD",
  )?.timestamp;

  if (!stdTimestamp) {
    return null;
  }

  const parsed = Date.parse(stdTimestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function asUldId(value: string): string {
  return value.split(":").at(-1) ?? value;
}

function getUldSpecRecord(uld: InventoryRecord): {
  autonomyHours: number;
  label: string;
  supportedShc: string[];
} {
  const rawRecord = (rawUldSpecsData as Record<string, UldSpecRecord>)[
    uld.uldProductCode ?? "GENERIC_PASSIVE"
  ];

  return {
    autonomyHours:
      typeof rawRecord?.ratedAutonomyHoursAt25C === "number"
        ? rawRecord.ratedAutonomyHoursAt25C
        : 6,
    label:
      typeof rawRecord?.label === "string" ? rawRecord.label : uld.uldTypeCode,
    supportedShc: readStringArray(rawRecord?.supportedShc),
  };
}

function getShcCode(uld: InventoryRecord): string {
  const override = ULD_SHC_OVERRIDES[uld.uldSerialNumber];

  if (override) {
    return override;
  }

  return getUldSpecRecord(uld).supportedShc[0] ?? "GEN";
}

function getThresholdInstructions(shcCode: string): TemperatureInstructions {
  const root = rawShcConfigData as {
    default?: RawShcEntry;
    shc?: Record<string, RawShcEntry>;
  };
  const shcEntry = root.shc?.[shcCode] ?? root.default;
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

function getFlightByNumber(
  flightNumber: string | null,
): TransportMovement | null {
  if (!flightNumber) {
    return null;
  }

  return (
    fallbackFlights.find((flight) => flight.flightNumber === flightNumber) ??
    null
  );
}

function getFlightNumberForUld(
  uldId: string,
  builtUldIds: string[],
): string | null {
  const mappedFlight = fallbackFlightMap[uldId];

  if (mappedFlight) {
    return mappedFlight;
  }

  const fallbackIndex = builtUldIds.indexOf(uldId);
  if (fallbackIndex < 0 || fallbackFlights.length === 0) {
    return null;
  }

  return (
    fallbackFlights[fallbackIndex % fallbackFlights.length]?.flightNumber ??
    null
  );
}

function toStageLabel(stage: string): string {
  switch (stage) {
    case "in-warehouse":
      return "Warehouse";
    case "in-tarmac":
      return "Tarmac";
    case "in-flight":
      return "In flight";
    case "arrived-tarmac":
      return "Arrived tarmac";
    case "arrived-destination":
      return "Destination";
    default:
      return "Unknown";
  }
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: DUBAI_TIME_ZONE,
  }).format(date);
}

function parseRelevantAudit(snapshot: AuditSnapshot) {
  const eventsById = new Map<string, LogisticsEvent>();
  const latestEventByUld = new Map<string, LogisticsEvent>();
  const latestActionByUld = new Map<string, LogisticsAction>();

  snapshot.events.forEach((event) => {
    eventsById.set(event["@id"], event);
    const uldId = asUldId(String(event.eventFor));
    const previous = latestEventByUld.get(uldId);

    if (
      !previous ||
      Date.parse(previous.eventDate) < Date.parse(event.eventDate)
    ) {
      latestEventByUld.set(uldId, event);
    }
  });

  snapshot.actions.forEach((action) => {
    if (!action.servedActivity) {
      return;
    }

    const linkedEvent = eventsById.get(action.servedActivity);
    if (!linkedEvent) {
      return;
    }

    const uldId = asUldId(String(linkedEvent.eventFor));
    const previous = latestActionByUld.get(uldId);

    if (
      !previous ||
      Date.parse(previous.actionStartTime) < Date.parse(action.actionStartTime)
    ) {
      latestActionByUld.set(uldId, action);
    }
  });

  return {
    latestActionByUld,
    latestEventByUld,
  };
}

function getLinearInterpolatedMinutes(
  curve: Record<string, unknown>,
  ambientC: number,
): number {
  const points = Object.entries(curve)
    .map(([key, value]) => {
      const match = /^ambient(-?\d+(?:\.\d+)?)c$/i.exec(key);
      if (!match || typeof value !== "number" || Number.isNaN(value)) {
        return null;
      }

      return {
        ambientC: Number.parseFloat(match[1]),
        minutes: value,
      };
    })
    .filter(
      (entry): entry is { ambientC: number; minutes: number } => entry !== null,
    )
    .sort((left, right) => left.ambientC - right.ambientC);

  if (points.length === 0) {
    return 999;
  }

  if (ambientC <= points[0].ambientC) {
    return points[0].minutes;
  }

  if (ambientC >= points[points.length - 1].ambientC) {
    return points[points.length - 1].minutes;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];

    if (ambientC >= current.ambientC && ambientC <= next.ambientC) {
      const ratio =
        (ambientC - current.ambientC) / (next.ambientC - current.ambientC);
      return current.minutes + (next.minutes - current.minutes) * ratio;
    }
  }

  return points[points.length - 1].minutes;
}

function buildSchedulerSnapshot(
  uld: InventoryRecord,
  shcCode: string,
  ambientC: number,
  nowMs: number,
  flight: TransportMovement | null,
  loading: Loading | undefined,
): SchedulerSnapshot {
  const root = rawShcConfigData as {
    default?: RawShcEntry;
    shc?: Record<string, RawShcEntry>;
  };
  const shcEntry = root.shc?.[shcCode] ?? root.default;
  const maxWaitAirMinutes = getLinearInterpolatedMinutes(
    shcEntry?.maxWaitMinutes ?? {},
    ambientC,
  );
  const exposureRatio =
    FALLBACK_EXPOSURE_RATIO[shcCode] ?? FALLBACK_EXPOSURE_RATIO.default;
  const fallbackLoadedAtMs = nowMs - maxWaitAirMinutes * exposureRatio * 60_000;
  const loadedAtMs = loading
    ? Date.parse(loading.actionStartTime)
    : fallbackLoadedAtMs;
  const pushTimeMs = loadedAtMs + maxWaitAirMinutes * 60_000;
  const towEstimateMinutes =
    TOW_ESTIMATE_MINUTES[shcCode] ?? TOW_ESTIMATE_MINUTES.default;
  const remainingMinutes = (pushTimeMs - nowMs) / 60_000;
  const holdDecision = remainingMinutes > towEstimateMinutes ? "HOLD" : "PUSH";
  const etdLabel = flight
    ? formatClock(new Date(getFlightStdMs(flight) ?? nowMs))
    : "--:--";

  return {
    holdDecision,
    maxWaitAirMinutes,
    pushTimeLabel: formatClock(new Date(pushTimeMs)),
    reason: `${uld.uldSerialNumber} ${holdDecision.toLowerCase()} at ${ambientC.toFixed(
      1,
    )}C, max wait ${maxWaitAirMinutes.toFixed(0)} min, tow ${towEstimateMinutes} min, ETD ${etdLabel}`,
  };
}

function getStatus(
  internalC: number,
  threshold: TemperatureInstructions,
  budgetPercent: number,
  scheduler: SchedulerSnapshot,
  latestEvent: LogisticsEvent | undefined,
  latestAction: LogisticsAction | undefined,
): TrackerStatus {
  if (
    internalC < threshold.minTemperature.value ||
    internalC > threshold.maxTemperature.value ||
    latestEvent?.eventCode === "BREACH_ACTUAL"
  ) {
    return "Excursion";
  }

  if (latestAction) {
    return "Action in progress";
  }

  if (
    latestEvent?.eventCode === "BREACH_PREDICTED" ||
    latestEvent?.eventCode === "WARNING_BUDGET_LOW" ||
    scheduler.holdDecision === "HOLD" ||
    budgetPercent < 30
  ) {
    return "Alert";
  }

  return "OK";
}

function buildRows(
  builtUldIds: string[],
  trackerMeasurements: TrackerMeasurementsByUld,
  weather: CanonicalWeather,
  polygons: AirportPolygons | null,
  logicalNowMs: number,
  auditSnapshot: AuditSnapshot,
): { heldCards: PushTimeCardData[]; rows: UldTrackerRow[] } {
  const rows: UldTrackerRow[] = [];
  const heldCards: PushTimeCardData[] = [];
  const { latestActionByUld, latestEventByUld } =
    parseRelevantAudit(auditSnapshot);
  const loadingByUld = new Map<string, Loading>();

  auditSnapshot.loadings.forEach((loading) => {
    const loadedUnit = loading.loadedUnits[0];
    if (!loadedUnit) {
      return;
    }

    const uldId = asUldId(String(loadedUnit));
    const previous = loadingByUld.get(uldId);

    if (
      !previous ||
      Date.parse(previous.actionStartTime) < Date.parse(loading.actionStartTime)
    ) {
      loadingByUld.set(uldId, loading);
    }
  });

  builtUldIds.forEach((uldId) => {
    const inventoryEntry = inventoryById[uldId];

    if (!inventoryEntry) {
      return;
    }

    const shcCode = getShcCode(inventoryEntry);
    const threshold = getThresholdInstructions(shcCode);
    const recentMeasurements = trackerMeasurements[uldId] ?? [];
    const stageResult =
      polygons !== null
        ? classifyState(uldId, recentMeasurements, polygons)
        : { stage: "in-warehouse" as TrackerStage };
    const flightNumber = getFlightNumberForUld(uldId, builtUldIds);
    const flight = getFlightByNumber(flightNumber);
    const thermal = computeThermalStatus({
      uld: inventoryEntry,
      measurements: recentMeasurements,
      shcCode,
      threshold,
      weather,
      stage: stageResult.stage as ThermalStage,
      logicalNowMs,
      flightId: flight?.["@id"],
      locationId: toIRI(`urn:cargo:zone:DXB-${stageResult.stage}`),
      latestEvent: latestEventByUld.get(uldId),
      latestAction: latestActionByUld.get(uldId),
    });
    const scheduler = buildSchedulerSnapshot(
      inventoryEntry,
      shcCode,
      thermal.effectiveAmbientC,
      logicalNowMs,
      flight,
      loadingByUld.get(uldId),
    );
    const { label } = getUldSpecRecord(inventoryEntry);
    const status = getStatus(
      thermal.internalC,
      threshold,
      thermal.budgetPercent,
      scheduler,
      latestEventByUld.get(uldId),
      latestActionByUld.get(uldId),
    );
    const flightStdMs = flight ? getFlightStdMs(flight) : null;

    rows.push({
      ambientC: thermal.ambientC,
      budgetRemainingHours: thermal.budgetH,
      budgetRemainingPercent: thermal.budgetPercent,
      budgetState: thermal.budgetTone,
      flightNumber,
      flightTimeLabel: flightStdMs
        ? formatClock(new Date(flightStdMs))
        : "--:--",
      internalC: thermal.internalC,
      shcCode,
      stage: stageResult.stage,
      stageLabel: toStageLabel(stageResult.stage),
      status,
      typeCode: inventoryEntry.uldTypeCode,
      typeLabel: label,
      uldId,
    });

    if (
      scheduler.holdDecision === "HOLD" &&
      stageResult.stage !== "in-flight" &&
      stageResult.stage !== "arrived-tarmac" &&
      stageResult.stage !== "arrived-destination"
    ) {
      heldCards.push({
        flightNumber,
        holdReason: scheduler.reason,
        maxWaitMinutes: scheduler.maxWaitAirMinutes,
        pushTimeLabel: scheduler.pushTimeLabel,
        status,
        uldId,
      });
    }
  });

  return { heldCards, rows };
}

export default function SupervisorPage() {
  const [weather, setWeather] = useState<CanonicalWeather>(defaultWeather);
  const [weatherSource, setWeatherSource] = useState<WeatherSource>("mock");
  const [auditSnapshot, setAuditSnapshot] = useState<AuditSnapshot>({
    actions: [],
    events: [],
    loadings: [],
  });
  const [polygons, setPolygons] = useState<AirportPolygons | null>(null);
  const [trackerMeasurements, setTrackerMeasurements] =
    useState<TrackerMeasurementsByUld>({});
  const [builtUldIds, setBuiltUldIds] = useState<string[]>([]);
  const [logicalNowMs, setLogicalNowMs] = useState<number>(simulationBaseMs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clockAnchor] = useState(() => ({
    baseMs: simulationBaseMs,
    startedAtMs: Date.now(),
  }));

  useEffect(() => {
    resetStateClassifier();

    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      setError(null);

      try {
        const [weatherResponse, airportPolygons, events, actions, loadings] =
          await Promise.all([
            fetch("/api/weather?airport=DXB", { cache: "no-store" }),
            loadAirportPolygons(),
            auditDb.events.toArray(),
            auditDb.actions.toArray(),
            auditDb.loadings.toArray(),
          ]);

        if (!cancelled) {
          if (weatherResponse.ok) {
            const weatherPayload =
              (await weatherResponse.json()) as CanonicalWeather;
            setWeather(weatherPayload);
            setWeatherSource(weatherPayload.source);
          }

          setPolygons(airportPolygons);
          setAuditSnapshot({ actions, events, loadings });

          const auditedUlds = Array.from(
            new Set(
              loadings
                .flatMap((loading) =>
                  loading.loadedUnits.map((unit) => asUldId(String(unit))),
                )
                .filter((uldId) => uldId in inventoryById),
            ),
          );

          setBuiltUldIds(auditedUlds);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load dashboard",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLogicalNowMs(
        clockAnchor.baseMs +
          (Date.now() - clockAnchor.startedAtMs) * LOGICAL_MULTIPLIER,
      );
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, [clockAnchor]);

  useEffect(() => {
    if (builtUldIds.length === 0 || !fallbackScenario) {
      return;
    }

    const feedEntries = builtUldIds
      .map((uldId) => {
        const feed = startTrackerFeed(uldId, fallbackScenario as never, () => {
          return (
            clockAnchor.baseMs +
            (Date.now() - clockAnchor.startedAtMs) * LOGICAL_MULTIPLIER
          );
        });

        if (feed === null) {
          return null;
        }

        return { feed, uldId };
      })
      .filter(
        (
          entry,
        ): entry is {
          feed: NonNullable<ReturnType<typeof startTrackerFeed>>;
          uldId: string;
        } => entry !== null,
      );

    const subscriptions = feedEntries.map(({ feed, uldId }) =>
      feed.subscribe((measurements) => {
        setTrackerMeasurements((current) => ({
          ...current,
          [uldId]: [...(current[uldId] ?? []), ...measurements].slice(
            -TRACKER_WINDOW,
          ),
        }));
      }),
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      feedEntries.forEach(({ feed }) => feed.stop());
    };
  }, [builtUldIds, clockAnchor]);

  const liveSnapshots =
    useLiveQuery(
      () => auditDb.uldStatus.toArray(),
      [],
      [] as UldThermalSnapshot[],
    ) ?? [];
  const snapshotByUld = new Map(
    liveSnapshots.map((snap) => [snap.uldId, snap] as const),
  );

  const { heldCards, rows: localRows } = buildRows(
    builtUldIds,
    trackerMeasurements,
    weather,
    polygons,
    logicalNowMs,
    auditSnapshot,
  );

  // Single source of truth: snapshot from auditDb.uldStatus written by the
  // global recalculator. Local compute is only used for fields the snapshot
  // doesn't carry (status badge, flight number, push-time scheduler).
  const rows: UldTrackerRow[] = localRows
    .filter((row) => snapshotByUld.has(row.uldId))
    .map((row) => {
      const snap = snapshotByUld.get(row.uldId)!;
      return {
        ...row,
        ambientC: snap.ambientC,
        budgetRemainingHours: snap.budgetH,
        budgetRemainingPercent: snap.budgetPercent,
        budgetState: snap.budgetTone,
        internalC: snap.internalC,
        stage: snap.stage as TrackerStage,
        stageLabel: toStageLabel(snap.stage as TrackerStage),
      };
    });

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="Supervisor operations wall"
        title="Live ULD tracker"
        actions={
          <>
            <WeatherSourceBadge source={weatherSource} />
            <OneConnectBadge />
            <Badge
              variant="outline"
              className="font-mono text-xs font-semibold"
            >
              {DXB_STATION}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-xs font-semibold text-muted-foreground"
            >
              {RESOURCE_FALLBACK.freeCoolDollies} cool dollies free
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-xs font-semibold text-muted-foreground"
            >
              {RESOURCE_FALLBACK.freeCoolRoomSlots} cool-room slots free
            </Badge>
          </>
        }
      />

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-5">
          <MissionHero
            eyebrow="Supervisor dashboard"
            title="Live ULD tracker"
            description="All built ULDs across today's DXB outbound flights, with thermal state, push-time risk, and mitigation status."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Tracked ULDs"
                value={rows.length}
                meta="Built units"
              />
              <MetricTile
                label="Active holds"
                value={heldCards.length}
                meta="Scheduler lane"
              />
              <MetricTile
                label="Updated"
                value={formatClock(new Date(logicalNowMs))}
                meta="DXB local"
              />
            </div>
          </MissionHero>

          {error ? (
            <Card className="mission-panel border-destructive/40">
              <CardContent className="p-6">
                <p className="text-base text-destructive">{error}</p>
              </CardContent>
            </Card>
          ) : null}

          <MissionPanel
            title="DXB outbound tracker"
            description="Sort by budget, stage, or status to prioritize supervisor attention."
            contentClassName="p-0"
          >
            <UldTrackerTable rows={rows} />
          </MissionPanel>
        </section>

        <section className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <WeatherPanel
            weather={weather}
            nowMs={logicalNowMs}
            isRefreshing={loading}
            description="DXB ramp now and forecast."
          />
          <MetricTile
            label="Free dollies"
            value={RESOURCE_FALLBACK.freeCoolDollies}
            meta="Cooling resource"
          />
          <MetricTile
            label="Cool-room slots"
            value={RESOURCE_FALLBACK.freeCoolRoomSlots}
            meta="Warehouse reserve"
          />
          {heldCards.length > 0 ? (
            heldCards.map((card) => <PushTimeCard key={card.uldId} {...card} />)
          ) : (
            <Card className="mission-panel border-dashed">
              <CardHeader className="gap-1">
                <CardTitle className="text-lg font-semibold leading-none">
                  No active hold windows
                </CardTitle>
                <CardDescription className="text-sm">
                  Sensitive ULDs will surface here when the push-time scheduler
                  moves them into hold.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div
            className={cn(
              "font-mono text-xs text-muted-foreground",
              loading ? "opacity-100" : "opacity-80",
            )}
          >
            {loading
              ? "Refreshing supervisor feed…"
              : `Updated ${formatClock(new Date(logicalNowMs))} DXB`}
          </div>
        </section>
      </main>
    </MissionShell>
  );
}
