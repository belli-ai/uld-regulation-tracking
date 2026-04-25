import type {
  Measurement,
  TemperatureInstructions,
} from "@/lib/ontology/one-record";
import type { UldPhysicsSpec } from "@/lib/physics/uld-specs-loader";

type AmbientSample = {
  timestampMs: number;
  temperatureC: number;
};

type TempTracePoint = {
  t: number;
  T: number;
};

type IntegrationResult = {
  budgetSec: number;
  breachAt: Date | null;
  tempTrace: TempTracePoint[];
};

function toCelsius(value: number, unit: string): number {
  return unit === "F" ? ((value - 32) * 5) / 9 : value;
}

function readMeasurementTemperature(measurement: Measurement): number {
  return toCelsius(
    measurement.measurementValue.value,
    measurement.measurementValue.unit,
  );
}

function readTimestampMs(measurement: Measurement): number {
  const timestampMs = Date.parse(measurement.measurementTimestamp);

  if (Number.isNaN(timestampMs)) {
    throw new Error(
      `Invalid measurement timestamp "${measurement.measurementTimestamp}".`,
    );
  }

  return timestampMs;
}

function readThresholdBounds(threshold: TemperatureInstructions): {
  minC: number;
  maxC: number;
} {
  return {
    minC: toCelsius(
      threshold.minTemperature.value,
      threshold.minTemperature.unit,
    ),
    maxC: toCelsius(
      threshold.maxTemperature.value,
      threshold.maxTemperature.unit,
    ),
  };
}

function interpolateAmbient(
  timeMs: number,
  curve: readonly AmbientSample[],
  startIndex: number,
): { temperatureC: number; nextIndex: number } {
  if (timeMs <= curve[0].timestampMs) {
    return { temperatureC: curve[0].temperatureC, nextIndex: 0 };
  }

  let index = startIndex;

  while (
    index < curve.length - 2 &&
    timeMs >= curve[index + 1].timestampMs
  ) {
    index += 1;
  }

  const left = curve[index];
  const right = curve[index + 1];

  if (!right) {
    return {
      temperatureC: curve[curve.length - 1].temperatureC,
      nextIndex: curve.length - 1,
    };
  }

  const spanMs = right.timestampMs - left.timestampMs;

  if (spanMs <= 0) {
    return { temperatureC: right.temperatureC, nextIndex: index + 1 };
  }

  const ratio = (timeMs - left.timestampMs) / spanMs;

  return {
    temperatureC:
      left.temperatureC + (right.temperatureC - left.temperatureC) * ratio,
    nextIndex: index,
  };
}

function hasBreached(
  temperatureC: number,
  threshold: TemperatureInstructions,
): boolean {
  const bounds = readThresholdBounds(threshold);
  return temperatureC < bounds.minC || temperatureC > bounds.maxC;
}

export function pcmAbsorption(T_c: number, spec: UldPhysicsSpec): number {
  if (spec.pcmMeltEnd <= spec.pcmMeltStart) {
    return 0;
  }

  if (T_c < spec.pcmMeltStart || T_c > spec.pcmMeltEnd) {
    return 0;
  }

  return (
    (spec.pcmMassKg * spec.pcmHeatOfFusionKJ_kg) /
    (spec.pcmMeltEnd - spec.pcmMeltStart)
  );
}

export function integrateBudget(
  uldSpec: UldPhysicsSpec,
  T_internal_now: number,
  ambientCurve: Measurement[],
  dt: number,
  breachThreshold: TemperatureInstructions,
): IntegrationResult {
  if (ambientCurve.length === 0) {
    throw new Error("ambientCurve must contain at least one measurement.");
  }

  if (dt <= 0) {
    throw new Error("dt must be greater than zero.");
  }

  const samples = ambientCurve
    .map((measurement) => ({
      timestampMs: readTimestampMs(measurement),
      temperatureC: readMeasurementTemperature(measurement),
    }))
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const startMs = samples[0].timestampMs;
  const endMs = samples[samples.length - 1].timestampMs;
  const totalDurationSec = Math.max(0, (endMs - startMs) / 1000);

  let ambientIndex = 0;
  let temperatureC = T_internal_now;
  let elapsedSec = 0;
  let budgetSec = totalDurationSec;
  let breachAt: Date | null = null;
  let nextTraceSampleSec = 60;

  const tempTrace: TempTracePoint[] = [{ t: 0, T: temperatureC }];

  while (elapsedSec < totalDurationSec) {
    const stepSec = Math.min(dt, totalDurationSec - elapsedSec);
    const currentTimeMs = startMs + elapsedSec * 1000;
    const ambientAtStep = interpolateAmbient(
      currentTimeMs,
      samples,
      ambientIndex,
    );

    ambientIndex = ambientAtStep.nextIndex;

    const effectiveThermalCapacitanceJ_K =
      uldSpec.thermalMassKJ_K * 1000 +
      pcmAbsorption(temperatureC, uldSpec) * 1000;
    const heatFluxW =
      uldSpec.uValueW_m2K *
      uldSpec.surfaceAreaM2 *
      (ambientAtStep.temperatureC - temperatureC);
    const deltaT =
      (heatFluxW * stepSec) / effectiveThermalCapacitanceJ_K;

    temperatureC += deltaT;
    elapsedSec += stepSec;

    while (nextTraceSampleSec <= elapsedSec) {
      tempTrace.push({ t: nextTraceSampleSec, T: temperatureC });
      nextTraceSampleSec += 60;
    }

    if (breachAt === null && hasBreached(temperatureC, breachThreshold)) {
      budgetSec = elapsedSec;
      breachAt = new Date(startMs + elapsedSec * 1000);
    }
  }

  if (tempTrace[tempTrace.length - 1]?.t !== totalDurationSec) {
    tempTrace.push({ t: totalDurationSec, T: temperatureC });
  }

  return {
    budgetSec,
    breachAt,
    tempTrace,
  };
}
