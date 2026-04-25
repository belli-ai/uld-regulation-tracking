import {
  getShcEntry,
  linearInterpolate,
  type ShcConfig,
} from "@/lib/scheduler/shc-loader";

export type UldContext = {
  uldId: string;
  shcCode: string;
  loadedAt: Date;
};

export type FlightInfo = {
  std: Date;
  etd: Date;
  towEstimateMinutes: number;
};

export type AmbientForecast = {
  ambientC: number;
};

export type HoldDecision = "PUSH" | "HOLD";

export type SchedulerResult = {
  pushTime: Date;
  maxWaitAir: number;
  holdDecision: HoldDecision;
  reason: string;
};

export function pushTime(
  uldContext: UldContext,
  flight: FlightInfo,
  ambientForecast: AmbientForecast,
  shcConfig: ShcConfig,
  nowMs = Date.now(),
): SchedulerResult {
  const shcEntry = getShcEntry(shcConfig, uldContext.shcCode);

  if (!shcEntry) {
    return {
      pushTime: new Date(flight.etd),
      maxWaitAir: Number.POSITIVE_INFINITY,
      holdDecision: "PUSH",
      reason: "No SHC constraints",
    };
  }

  const { temperatureInstructions } = shcEntry;
  const maxWaitAir = linearInterpolate(
    ambientForecast.ambientC,
    shcEntry.maxWaitMinutes,
  );
  const pushTimeMs = uldContext.loadedAt.getTime() + maxWaitAir * 60_000;
  const towWindowMs = flight.towEstimateMinutes * 60_000;
  const remainingMs = pushTimeMs - nowMs;
  const holdDecision: HoldDecision =
    remainingMs > towWindowMs ? "HOLD" : "PUSH";
  const reason = [
    `${uldContext.uldId} ${holdDecision.toLowerCase()} decision for ${uldContext.shcCode}`,
    `ambient ${ambientForecast.ambientC.toFixed(1)}C`,
    `max wait ${maxWaitAir.toFixed(2)} min`,
    `temp range ${temperatureInstructions.minTemperature.value}-${temperatureInstructions.maxTemperature.value}${temperatureInstructions.maxTemperature.unit}`,
    `remaining ${(remainingMs / 60_000).toFixed(2)} min`,
    `tow ${flight.towEstimateMinutes.toFixed(2)} min`,
    `STD ${flight.std.toISOString()}`,
    `ETD ${flight.etd.toISOString()}`,
  ].join("; ");

  return {
    pushTime: new Date(pushTimeMs),
    maxWaitAir,
    holdDecision,
    reason,
  };
}
