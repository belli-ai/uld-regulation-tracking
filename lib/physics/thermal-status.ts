import {
  excursionLogger,
  type ExcursionEventCode,
  type UldContext,
} from "@/lib/audit/excursion-logger";
import type { CanonicalWeather } from "@/lib/adapters/weather";
import {
  toIRI,
  type IRI,
  type LogisticsAction,
  type LogisticsEvent,
  type Measurement,
  type TemperatureInstructions,
  type ULD,
} from "@/lib/ontology/one-record";
import { integrateBudget } from "@/lib/physics/pcm-model";
import {
  getUldSpec,
  type UldPhysicsSpec,
} from "@/lib/physics/uld-specs-loader";

/**
 * Canonical 5-stage lifecycle. Both the supervisor dashboard and the
 * flight monitor route surface the same enum so the thermal model maps
 * 1:1 in either surface.
 */
export type ThermalStage =
  | "in-warehouse"
  | "in-tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

/**
 * Stage-aware ambient model.
 *
 *   in-warehouse / arrived-destination
 *     The cool-room HVAC dominates. Reference internal stays close to
 *     the cool-room set point with a small bleed from external weather.
 *     Per `MOCK_DATA.md → DXB Geofence`, the cool-room references 5°C.
 *
 *   in-tarmac / arrived-tarmac
 *     ULD is exposed to apron weather. Effective ambient mirrors the
 *     Open-Meteo curve sampled at the integration step.
 *
 *   in-flight
 *     Cargo hold is conditioned. We assume a steady ~15°C regardless of
 *     external weather. Real ops varies by aircraft; this is good
 *     enough for the hackathon.
 */
export const COOL_ROOM_REF_C = 5;
export const COOL_ROOM_WEATHER_BLEND = 0.15;
export const IN_FLIGHT_HOLD_C = 15;
export const FORECAST_HOURS = 12;
export const FORECAST_STEP_HOURS = 1;

/**
 * Budget colour thresholds (percent of rated autonomy remaining).
 * Centralised here so badges match across surfaces.
 *
 *   percent > 50          → green
 *   30 <= percent <= 50   → yellow
 *   percent < 30          → red
 */
export const BUDGET_TONE_THRESHOLDS = {
  yellowAtPercent: 50,
  redAtPercent: 30,
} as const;

export const EXCURSION_THRESHOLD = {
  breachPredictionWindowMinutes: 60,
  warningBudgetPercent: 30,
} as const;

export type BudgetTone = "green" | "yellow" | "red";

export type ThermalContext = {
  uld: ULD & {
    iotDeviceId?: string;
    lastKnownInternalC?: number;
    uldProductCode?: string;
  };
  measurements?: Measurement[];
  shcCode: string;
  threshold: TemperatureInstructions;
  weather: CanonicalWeather;
  stage: ThermalStage;
  logicalNowMs: number;
  flightId?: IRI;
  locationId: IRI;
  latestEvent?: LogisticsEvent;
  latestAction?: LogisticsAction;
};

export type ThermalStatus = {
  stage: ThermalStage;
  isPassive: boolean;
  internalC: number;
  ambientC: number;
  effectiveAmbientC: number;
  budgetH: number;
  budgetPercent: number;
  budgetTone: BudgetTone;
  breachAt: Date | null;
  predictedBreachMinutes: number | null;
  excursionEvent: LogisticsEvent | null;
  excursionEventCode: ExcursionEventCode | null;
  ambientForecast: Measurement[];
  autonomyHours: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function effectiveAmbientForStage(
  stage: ThermalStage,
  rawAmbientC: number,
): number {
  switch (stage) {
    case "in-warehouse":
    case "arrived-destination":
      return (
        COOL_ROOM_REF_C +
        (rawAmbientC - COOL_ROOM_REF_C) * COOL_ROOM_WEATHER_BLEND
      );
    case "in-tarmac":
    case "arrived-tarmac":
      return rawAmbientC;
    case "in-flight":
      return IN_FLIGHT_HOLD_C;
  }
}

export function sampleWeatherC(
  weather: CanonicalWeather,
  timeMs: number,
): number {
  if (weather.hourly.length === 0) {
    return 30;
  }

  const readings = weather.hourly
    .map((entry) => ({
      ambientC: entry.ambientC,
      timestampMs: Date.parse(entry.timestamp),
    }))
    .filter((entry) => Number.isFinite(entry.timestampMs))
    .sort((left, right) => left.timestampMs - right.timestampMs);

  if (readings.length === 0) {
    return 30;
  }

  if (timeMs <= readings[0].timestampMs) {
    return readings[0].ambientC;
  }

  if (timeMs >= readings[readings.length - 1].timestampMs) {
    return readings[readings.length - 1].ambientC;
  }

  for (let index = 0; index < readings.length - 1; index += 1) {
    const current = readings[index];
    const next = readings[index + 1];

    if (timeMs >= current.timestampMs && timeMs <= next.timestampMs) {
      const ratio =
        (timeMs - current.timestampMs) /
        (next.timestampMs - current.timestampMs);
      return current.ambientC + (next.ambientC - current.ambientC) * ratio;
    }
  }

  return readings[readings.length - 1].ambientC;
}

export function buildStageAmbientCurve(
  weather: CanonicalWeather,
  stage: ThermalStage,
  nowMs: number,
  options: { hours?: number; stepHours?: number } = {},
): Measurement[] {
  const hours = options.hours ?? FORECAST_HOURS;
  const stepHours = options.stepHours ?? FORECAST_STEP_HOURS;
  const stepCount = Math.max(1, Math.round(hours / stepHours));
  const curve: Measurement[] = [];

  for (let index = 0; index <= stepCount; index += 1) {
    const offsetMs = index * stepHours * 3_600_000;
    const sampleMs = nowMs + offsetMs;
    const rawAmbient = sampleWeatherC(weather, sampleMs);
    const effective = effectiveAmbientForStage(stage, rawAmbient);
    curve.push({
      "@id": toIRI(
        `urn:cargo:measurement:ambient-${stage}-${index}-${sampleMs}`,
      ),
      "@type": "Measurement",
      bySensor: toIRI(`urn:cargo:sensor:ambient:${stage}`),
      measurementTimestamp: new Date(sampleMs).toISOString(),
      measurementValue: { unit: "C", value: effective },
    });
  }

  return curve;
}

function deriveUldSpec(uld: ThermalContext["uld"]): UldPhysicsSpec {
  try {
    return getUldSpec(uld.uldProductCode ?? "GENERIC_PASSIVE");
  } catch {
    return getUldSpec("GENERIC_PASSIVE");
  }
}

function thresholdMidpointC(threshold: TemperatureInstructions): number {
  const min = threshold.minTemperature.value;
  const max = threshold.maxTemperature.value;
  return (min + max) / 2;
}

function deriveInternalC(ctx: ThermalContext): {
  internalC: number;
  isPassive: boolean;
} {
  const measurement = ctx.measurements
    ? [...ctx.measurements]
        .reverse()
        .find((m) => m.measurementValue.unit === "C")
    : undefined;

  if (measurement) {
    return { internalC: measurement.measurementValue.value, isPassive: false };
  }

  if (typeof ctx.uld.lastKnownInternalC === "number") {
    return {
      internalC: ctx.uld.lastKnownInternalC,
      isPassive: !ctx.uld.iotDeviceId,
    };
  }

  return {
    internalC: thresholdMidpointC(ctx.threshold),
    isPassive: !ctx.uld.iotDeviceId,
  };
}

function toBudgetTone(percent: number): BudgetTone {
  if (percent < BUDGET_TONE_THRESHOLDS.redAtPercent) return "red";
  if (percent <= BUDGET_TONE_THRESHOLDS.yellowAtPercent) return "yellow";
  return "green";
}

/**
 * Single source of truth for ULD thermal status — used by the supervisor
 * dashboard and the flight-level monitor so badges, alerts, and
 * excursion events stay aligned.
 *
 * Stage drives the ambient model:
 *   warehouse/destination → cool-room reference with mild weather bleed
 *   tarmac (origin or dest) → raw weather curve
 *   in-flight → conditioned hold
 */
export function computeThermalStatus(ctx: ThermalContext): ThermalStatus {
  const spec = deriveUldSpec(ctx.uld);
  const { internalC, isPassive } = deriveInternalC(ctx);
  const ambientC = sampleWeatherC(ctx.weather, ctx.logicalNowMs);
  const effectiveAmbientC = effectiveAmbientForStage(ctx.stage, ambientC);
  const ambientForecast = buildStageAmbientCurve(
    ctx.weather,
    ctx.stage,
    ctx.logicalNowMs,
  );

  const integration = integrateBudget(
    spec,
    internalC,
    ambientForecast,
    60,
    ctx.threshold,
  );

  const budgetH = Math.max(0, integration.budgetSec / 3600);
  const autonomyHours = spec.autonomyHours > 0 ? spec.autonomyHours : 1;
  const budgetPercent = clamp((budgetH / autonomyHours) * 100, 0, 100);

  const predictedBreachMinutes = integration.breachAt
    ? Math.max(0, (integration.breachAt.getTime() - ctx.logicalNowMs) / 60_000)
    : null;

  const excursionContext: UldContext = {
    ambientTemperatureC: effectiveAmbientC,
    flightId: ctx.flightId,
    internalTemperatureC: internalC,
    locationId: ctx.locationId,
    observedAt: new Date(ctx.logicalNowMs).toISOString(),
    predictedBreachInMinutes: predictedBreachMinutes,
    state: ctx.stage,
    thermalBudgetRemainingPercent: budgetPercent,
    uldId: ctx.uld["@id"],
  };

  const excursionEvent = excursionLogger.detect(excursionContext, {
    breachPredictionWindowMinutes:
      EXCURSION_THRESHOLD.breachPredictionWindowMinutes,
    maxInternalTemperatureC: ctx.threshold.maxTemperature.value,
    warningBudgetPercent: EXCURSION_THRESHOLD.warningBudgetPercent,
  });
  // publish handled at client call site

  return {
    stage: ctx.stage,
    isPassive,
    internalC,
    ambientC,
    effectiveAmbientC,
    budgetH,
    budgetPercent,
    budgetTone: toBudgetTone(budgetPercent),
    breachAt: integration.breachAt,
    predictedBreachMinutes,
    excursionEvent,
    excursionEventCode:
      (excursionEvent?.eventCode as ExcursionEventCode | undefined) ?? null,
    ambientForecast,
    autonomyHours: spec.autonomyHours,
  };
}
