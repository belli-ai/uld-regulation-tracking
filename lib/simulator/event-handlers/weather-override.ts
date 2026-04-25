import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleWeatherOverride(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const ambientC =
    typeof event.ambient_c === "number"
      ? event.ambient_c
      : typeof event.value === "number" && event.param === "ambient_c"
        ? event.value
        : null;
  const humidityPct =
    typeof event.humidity_pct === "number" ? event.humidity_pct : null;
  const cloudCoverPct =
    typeof event.cloud_cover_pct === "number" ? event.cloud_cover_pct : null;

  ctx.setState((state) => ({
    statusMessage:
      ambientC !== null ? `Ambient overridden to ${ambientC}°C` : state.statusMessage,
    weather: {
      ambientC: ambientC ?? state.weather.ambientC,
      cloudCoverPct: cloudCoverPct ?? state.weather.cloudCoverPct,
      humidityPct: humidityPct ?? state.weather.humidityPct,
      ramp: null,
    },
  }));

  ctx.addLog("Weather override applied", "info");
}
