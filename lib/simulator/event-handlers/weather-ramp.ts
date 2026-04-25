import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleWeatherRamp(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const param =
    event.param === "ambient_c" ||
    event.param === "humidity_pct" ||
    event.param === "cloud_cover_pct"
      ? event.param
      : null;

  if (
    param === null ||
    typeof event.from !== "number" ||
    typeof event.to !== "number" ||
    typeof event.over_s !== "number"
  ) {
    return;
  }
  const from = event.from;
  const to = event.to;
  const overSec = event.over_s;

  const currentTickSec = ctx.stores.demoClock.getState().currentTickSec;
  ctx.setState((state) => ({
    statusMessage: `Weather ramping ${param} from ${from} to ${to}`,
    weather: {
      ...state.weather,
      ramp: {
        endTickSec: currentTickSec + overSec,
        from,
        overSec,
        param,
        startTickSec: currentTickSec,
        to,
      },
    },
  }));

  ctx.addLog(`Weather ramp scheduled for ${param}`, "info");
}
