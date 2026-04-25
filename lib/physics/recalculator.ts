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
import { computeThermalStatus } from "@/lib/physics/thermal-status";
import { getSimulationNowMs } from "@/lib/clock/simulation-clock";
import { shiftTimestamps } from "@/lib/data/flights-shifted";
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

async function listBuiltUlds(): Promise<FlightSummary[]> {
  const loadings = await auditDb.loadings.toArray().catch(() => []);
  const seen = new Map<string, FlightSummary>();
  for (const loading of loadings) {
    const uldId = asUldId(loading.loadedUnits?.[0]);
    if (!uldId) continue;
    const flightNumber = (() => {
      const tag = loading.otherIdentifiers?.find(
        (id) => typeof id === "string" && id.startsWith("flight:"),
      );
      return typeof tag === "string" ? tag.replace("flight:", "") : null;
    })();
    seen.set(uldId, { uldId, flightNumber });
  }
  return Array.from(seen.values());
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

    for (const { uldId, flightNumber } of built) {
      const inventory = inventoryById[uldId];
      if (!inventory) continue;

      const shcCode = getShcCodeForUld(inventory);
      const threshold = getThresholdInstructions(shcCode);
      const measurements: Measurement[] = readWindowMeasurements(uldId);
      const stage = deriveStage(uldId, measurements, polygons, events);

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
        uld: inventory,
        weather: cachedWeather,
      });

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
