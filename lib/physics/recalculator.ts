"use client";

import {
  adaptMockWeather,
  type CanonicalWeather,
} from "@/lib/adapters/weather";
import { classifyState } from "@/lib/inference/state-classifier";

type Stage =
  | "in-warehouse"
  | "in-tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";
import {
  loadAirportPolygons,
  type AirportPolygons,
} from "@/lib/inference/airport-polygons-loader";
import {
  toIRI,
  type LogisticsEvent,
  type Measurement,
  type TemperatureInstructions,
  type ULD,
} from "@/lib/ontology/one-record";
import { auditDb, type UldThermalSnapshot } from "@/lib/persistence/audit-db";
import {
  buildStageAmbientCurve,
  computeThermalStatus,
} from "@/lib/physics/thermal-status";
import { integrateBudget } from "@/lib/physics/pcm-model";
import { getUldSpec } from "@/lib/physics/uld-specs-loader";
import { getSimulationNowMs } from "@/lib/clock/simulation-clock";
import { getShiftedFlights, shiftTimestamps } from "@/lib/data/flights-shifted";
import { parseShcConfig, type ShcConfig } from "@/lib/scheduler/shc-loader";
import { pushTime } from "@/lib/scheduler/push-time";
import rawShcConfig from "@/public/config/shc.json";
import rawInventoryData from "@/public/data/uld-inventory.json";
import rawWeatherData from "@/public/data/weather/DXB.json";

type RawShcEntry = {
  temperatureInstructions?: {
    minTemperature?: { value?: unknown; unit?: unknown };
    maxTemperature?: { value?: unknown; unit?: unknown };
  };
};

type InventoryRecord = ULD & {
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
  uldProductCode?: string;
  shc?: string;
};

const SHC_CONFIG = rawShcConfig as {
  default?: RawShcEntry;
  shc?: Record<string, RawShcEntry>;
};

const inventoryById: Record<string, InventoryRecord> = (() => {
  const out: Record<string, InventoryRecord> = {};
  for (const entry of rawInventoryData as InventoryRecord[]) {
    out[entry.uldSerialNumber] = entry;
    out[String(entry["@id"])] = entry;
  }
  return out;
})();

function applyShiftToWeather(weather: CanonicalWeather): CanonicalWeather {
  return {
    ...weather,
    hourly: shiftTimestamps(weather.hourly),
  };
}

let cachedWeather: CanonicalWeather = applyShiftToWeather(
  adaptMockWeather(rawWeatherData as unknown, "DXB"),
);
let cachedPolygons: AirportPolygons | null = null;
let polygonLoadStarted = false;
let weatherLastFetchedMs = 0;
const WEATHER_TTL_MS = 60_000;

async function ensurePolygons(): Promise<AirportPolygons | null> {
  if (cachedPolygons) return cachedPolygons;
  if (polygonLoadStarted) return null;
  polygonLoadStarted = true;
  try {
    cachedPolygons = await loadAirportPolygons();
  } catch (error) {
    console.warn("[recalculator] failed to load polygons", error);
    cachedPolygons = null;
  }
  return cachedPolygons;
}

async function refreshWeather(nowMs: number): Promise<void> {
  if (nowMs - weatherLastFetchedMs < WEATHER_TTL_MS) {
    return;
  }
  weatherLastFetchedMs = nowMs;
  try {
    const response = await fetch("/api/weather?airport=DXB", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as CanonicalWeather;
    if (payload && Array.isArray(payload.hourly)) {
      cachedWeather = applyShiftToWeather(payload);
    }
  } catch {
    // Keep prior cachedWeather; mock fallback acceptable.
  }
}

function getThresholdInstructions(shcCode: string): TemperatureInstructions {
  const entry = SHC_CONFIG.shc?.[shcCode] ?? SHC_CONFIG.default;
  const minValue = entry?.temperatureInstructions?.minTemperature?.value;
  const maxValue = entry?.temperatureInstructions?.maxTemperature?.value;
  const minUnit = entry?.temperatureInstructions?.minTemperature?.unit;
  const maxUnit = entry?.temperatureInstructions?.maxTemperature?.unit;
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

function getShcCodeForUld(inventory: InventoryRecord): string {
  if (inventory.shc) return inventory.shc;
  switch (inventory.uldTypeCode) {
    case "AKE":
    case "AKW":
    case "RKN":
      return "COL";
    case "AKH":
      return "AVI";
    case "AAU":
      return "CRT";
    case "AAY":
      return "HEG";
    default:
      return "GEN";
  }
}

const STAGE_BY_EVENT_CODE: Record<string, Stage> = {
  BUILD_UP_COMPLETE: "in-warehouse",
  STATE_WAREHOUSE_IN: "in-warehouse",
  STATE_TARMAC_IN: "in-tarmac",
  STATE_FLIGHT_IN: "in-flight",
  STATE_TARMAC_DEST_IN: "arrived-tarmac",
  STATE_DEST_WAREHOUSE_IN: "arrived-destination",
};

function stageFromEvents(
  uldId: string,
  events: LogisticsEvent[],
): Stage | null {
  const candidates = events
    .filter((event) => {
      const target = String(event.eventFor ?? "");
      const tail = target.split(":").at(-1) ?? target;
      return tail === uldId;
    })
    .sort(
      (left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate),
    );

  for (const event of candidates) {
    const stage = STAGE_BY_EVENT_CODE[event.eventCode];
    if (stage) return stage;
  }
  return null;
}

function deriveStage(
  uldId: string,
  measurements: Measurement[],
  polygons: AirportPolygons | null,
  events: LogisticsEvent[],
): Stage {
  const eventStage = stageFromEvents(uldId, events);
  if (eventStage) {
    return eventStage;
  }

  if (polygons && measurements.length > 0) {
    const result = classifyState(uldId, measurements, polygons);
    return result.stage as Stage;
  }
  return "in-warehouse";
}

function asUldId(value: string | undefined): string | null {
  if (!value) return null;
  return value.split(":").at(-1) ?? value;
}

type FlightSummary = {
  uldId: string;
  flightNumber: string | null;
};

type FlightSummaryFull = FlightSummary & {
  loadedAtMs: number | null;
};

async function listBuiltUlds(): Promise<FlightSummaryFull[]> {
  const loadings = await auditDb.loadings.toArray().catch(() => []);
  const seen = new Map<string, FlightSummaryFull>();
  for (const loading of loadings) {
    const uldId = asUldId(loading.loadedUnits?.[0]);
    if (!uldId) continue;
    const flightNumber = (() => {
      const tag = loading.otherIdentifiers?.find(
        (id) => typeof id === "string" && id.startsWith("flight:"),
      );
      return typeof tag === "string" ? tag.replace("flight:", "") : null;
    })();
    const loadedAtMs = (() => {
      const ts = Date.parse(loading.actionStartTime);
      return Number.isFinite(ts) ? ts : null;
    })();
    seen.set(uldId, { uldId, flightNumber, loadedAtMs });
  }
  return Array.from(seen.values());
}

const cachedShcConfig: ShcConfig = parseShcConfig(rawShcConfig);

const TOW_ESTIMATE_MINUTES_BY_SHC: Record<string, number> = {
  AVI: 5,
  PER: 12,
  COL: 18,
  CRT: 25,
  FRO: 20,
  HEG: 6,
};

function getStdMsForFlight(flightNumber: string | null): number | null {
  if (!flightNumber) return null;
  const flight = getShiftedFlights().find(
    (f) => f.flightNumber === flightNumber,
  );
  if (!flight) return null;
  const std = flight.movementTimes.find((m) => m.type === "STD")?.timestamp;
  if (!std) return null;
  const ms = Date.parse(std);
  return Number.isFinite(ms) ? ms : null;
}

let inFlight = false;

export async function recalculateAll(
  nowMs: number = getSimulationNowMs(),
): Promise<void> {
  if (typeof window === "undefined") return;
  if (inFlight) return;
  inFlight = true;

  try {
    const [polygons] = await Promise.all([
      ensurePolygons(),
      refreshWeather(nowMs),
    ]);

    const built = await listBuiltUlds();
    if (built.length === 0) {
      return;
    }

    const events = await auditDb.events.toArray().catch(() => []);
    const snapshots: UldThermalSnapshot[] = [];

    const priorSnapshots = await auditDb.uldStatus.toArray().catch(() => []);
    const priorByUld = new Map(priorSnapshots.map((s) => [s.uldId, s]));

    for (const { uldId, flightNumber, loadedAtMs } of built) {
      const inventory = inventoryById[uldId];
      if (!inventory) continue;

      const shcCode = getShcCodeForUld(inventory);
      const threshold = getThresholdInstructions(shcCode);
      const measurements: Measurement[] = readWindowMeasurements(uldId);
      const stage = deriveStage(uldId, measurements, polygons, events);

      // Bridge integrate from the prior snapshot so internal temp evolves
      // tick-over-tick. Without this, internalC is rebooted each tick to
      // lastKnownInventoryC and the budget never moves with sim time.
      const prior = priorByUld.get(uldId);
      const bootstrappedInventory = bridgeInternalC(
        inventory,
        prior,
        cachedWeather,
        stage,
        threshold,
        nowMs,
      );

      // Cap forecast horizon at hours-until-ETD so budget reflects only
      // the time the ULD actually has under our control. Past departure
      // it's the receiving station's clock.
      const stdMsForHorizon = getStdMsForFlight(flightNumber);
      const etdHorizonHours =
        stdMsForHorizon !== null
          ? Math.max(0, (stdMsForHorizon - nowMs) / 3_600_000)
          : 12;

      const thermal = computeThermalStatus({
        flightId: flightNumber
          ? toIRI(`urn:cargo:flight:${flightNumber}`)
          : undefined,
        latestAction: undefined,
        latestEvent: undefined,
        locationId: toIRI(`urn:cargo:zone:DXB-${stage}`),
        logicalNowMs: nowMs,
        measurements,
        shcCode,
        stage,
        threshold,
        uld: bootstrappedInventory,
        weather: cachedWeather,
        horizonHours: etdHorizonHours,
      });

      const position = derivePosition(measurements, inventory, polygons);

      // Status badge — single source for supervisor / monitor / uld-detail.
      // Excursion takes priority over Alert; Alert uses 20% of the SHC
      // band as the "approaching threshold" buffer.
      const minC = threshold.minTemperature.value;
      const maxC = threshold.maxTemperature.value;
      const ALERT_BUFFER_RATIO = 0.2;
      const alertBuffer = Math.max(0.5, (maxC - minC) * ALERT_BUFFER_RATIO);
      let status: "Excursion" | "Alert" | "Action in progress" | "OK" = "OK";
      if (thermal.internalC < minC || thermal.internalC > maxC) {
        status = "Excursion";
      } else if (
        thermal.internalC <= minC + alertBuffer ||
        thermal.internalC >= maxC - alertBuffer ||
        thermal.budgetPercent < 30
      ) {
        status = "Alert";
      }

      // Push-time scheduler: when should this ULD leave the cool room
      // for the tarmac? Combines current ambient, SHC max-wait curve,
      // loadedAt (from auditDb.loadings), and flight STD.
      const stdMs = getStdMsForFlight(flightNumber);
      let pushTimeMs: number | null = null;
      let holdDecision: "PUSH" | "HOLD" | "RELEASED" | null = null;
      let holdReason: string | null = null;
      let maxWaitMinutes: number | null = null;

      if (loadedAtMs !== null && stdMs !== null) {
        const towMin =
          TOW_ESTIMATE_MINUTES_BY_SHC[shcCode] ??
          TOW_ESTIMATE_MINUTES_BY_SHC.CRT;
        const released =
          stage === "in-tarmac" ||
          stage === "in-flight" ||
          stage === "arrived-tarmac" ||
          stage === "arrived-destination";
        const result = pushTime(
          { uldId, shcCode, loadedAt: new Date(loadedAtMs) },
          {
            std: new Date(stdMs),
            etd: new Date(stdMs),
            towEstimateMinutes: towMin,
          },
          { ambientC: thermal.effectiveAmbientC },
          cachedShcConfig,
          nowMs,
        );
        pushTimeMs = result.pushTime.getTime();
        holdDecision = released ? "RELEASED" : result.holdDecision;
        holdReason = result.reason;
        maxWaitMinutes = Number.isFinite(result.maxWaitAir)
          ? result.maxWaitAir
          : null;
      }

      snapshots.push({
        ambientC: thermal.ambientC,
        breachAtMs: thermal.breachAt ? thermal.breachAt.getTime() : null,
        budgetH: thermal.budgetH,
        budgetPercent: thermal.budgetPercent,
        budgetTone: thermal.budgetTone,
        effectiveAmbientC: thermal.effectiveAmbientC,
        flightNumber,
        internalC: thermal.internalC,
        isPassive: thermal.isPassive,
        predictedBreachMinutes: thermal.predictedBreachMinutes,
        shcCode,
        stage: thermal.stage,
        uldId,
        uldProductCode: inventory.uldProductCode ?? null,
        latestLat: position.lat,
        latestLon: position.lon,
        zoneName: position.zoneName,
        trackerSource: position.source,
        lastMeasurementMs: position.lastMeasurementMs,
        pushTimeMs,
        holdDecision,
        holdReason,
        maxWaitMinutes,
        status: holdDecision === "HOLD" && status === "OK" ? "Alert" : status,
        updatedMs: nowMs,
      });
    }

    if (snapshots.length > 0) {
      await auditDb.uldStatus.bulkPut(snapshots);
    }
  } catch (error) {
    console.warn("[recalculator] tick failed", error);
  } finally {
    inFlight = false;
  }
}

const measurementWindow: Record<string, Measurement[]> = {};

export function pushMeasurementForRecalc(
  uldId: string,
  measurement: Measurement,
  windowSize = 48,
): void {
  const window = measurementWindow[uldId] ?? [];
  window.push(measurement);
  while (window.length > windowSize) window.shift();
  measurementWindow[uldId] = window;
}

function readWindowMeasurements(uldId: string): Measurement[] {
  return measurementWindow[uldId] ?? [];
}

type PositionSnapshot = {
  lat: number | null;
  lon: number | null;
  zoneName: string | null;
  source: "measured" | "inferred";
  lastMeasurementMs: number | null;
};

function parseZoneFromIri(value: string | undefined): string | null {
  if (!value) return null;
  const tail = value.split(":").at(-1) ?? value;
  const dashIdx = tail.indexOf("-");
  return dashIdx >= 0 ? tail.slice(dashIdx + 1) : tail;
}

function findGpsMeasurement(
  measurements: Measurement[],
): Measurement | undefined {
  for (let i = measurements.length - 1; i >= 0; i -= 1) {
    const m = measurements[i];
    const geo = (m as { recordedGeolocation?: unknown }).recordedGeolocation;
    if (
      geo &&
      typeof (geo as { latitude?: unknown }).latitude === "number" &&
      typeof (geo as { longitude?: unknown }).longitude === "number"
    ) {
      return m;
    }
  }
  return undefined;
}

function zoneCenterFromPolygons(
  polygons: AirportPolygons | null,
  zoneName: string | null,
): { lat: number; lon: number } | null {
  if (!polygons || !zoneName) return null;
  const zones = (polygons as unknown as { zones?: unknown }).zones;
  if (!Array.isArray(zones)) return null;
  for (const zone of zones) {
    const z = zone as {
      name?: unknown;
      id?: unknown;
      center?: { lat?: unknown; lon?: unknown };
    };
    const id = typeof z.id === "string" ? z.id : null;
    const name = typeof z.name === "string" ? z.name : null;
    if (id !== zoneName && name !== zoneName) continue;
    const lat = z.center?.lat;
    const lon = z.center?.lon;
    if (typeof lat === "number" && typeof lon === "number") {
      return { lat, lon };
    }
  }
  return null;
}

function derivePosition(
  measurements: Measurement[],
  inventory: InventoryRecord,
  polygons: AirportPolygons | null,
): PositionSnapshot {
  const gps = findGpsMeasurement(measurements);
  if (gps) {
    const geo = (
      gps as {
        recordedGeolocation?: { latitude?: number; longitude?: number };
      }
    ).recordedGeolocation;
    const ts = Date.parse(gps.measurementTimestamp);
    return {
      lat: geo?.latitude ?? null,
      lon: geo?.longitude ?? null,
      zoneName: parseZoneFromIri(inventory.lastKnownLocation),
      source: "measured",
      lastMeasurementMs: Number.isFinite(ts) ? ts : null,
    };
  }

  const zoneName = parseZoneFromIri(inventory.lastKnownLocation);
  const center = zoneCenterFromPolygons(polygons, zoneName);
  return {
    lat: center?.lat ?? null,
    lon: center?.lon ?? null,
    zoneName,
    source: "inferred",
    lastMeasurementMs: null,
  };
}

// Cap on how much sim time a single bridge step covers. Prevents tab
// throttling or long pauses from forecasting hours forward in one shot.
const MAX_BRIDGE_HOURS = 6;

function bridgeInternalC(
  inventory: InventoryRecord,
  prior: { internalC: number; updatedMs: number } | undefined,
  weather: CanonicalWeather,
  stage:
    | "in-warehouse"
    | "in-tarmac"
    | "in-flight"
    | "arrived-tarmac"
    | "arrived-destination",
  threshold: TemperatureInstructions,
  nowMs: number,
): InventoryRecord {
  if (!prior || prior.updatedMs >= nowMs) return inventory;
  const elapsedMs = nowMs - prior.updatedMs;
  const elapsedHours = elapsedMs / 3_600_000;
  if (elapsedHours <= 0) return inventory;

  const hours = Math.min(elapsedHours, MAX_BRIDGE_HOURS);
  const stepHours = Math.min(0.25, hours / 4);
  const bridgeCurve = buildStageAmbientCurve(weather, stage, prior.updatedMs, {
    hours,
    stepHours,
  });

  const spec = (() => {
    try {
      return getUldSpec(inventory.uldProductCode ?? "GENERIC_PASSIVE");
    } catch {
      return getUldSpec("GENERIC_PASSIVE");
    }
  })();

  const result = integrateBudget(
    spec,
    prior.internalC,
    bridgeCurve,
    60,
    threshold,
  );
  const finalTrace = result.tempTrace[result.tempTrace.length - 1];
  const bridgedC = finalTrace?.T ?? prior.internalC;

  return {
    ...inventory,
    lastKnownInternalC: bridgedC,
  };
}
