import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const AMBIENT_BY_TIME: Record<TimeOfDay, number> = {
  afternoon: 38,
  evening: 29,
  morning: 31,
  night: 24,
};

export async function handleTimeOfDayChange(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const timeOfDay =
    event.time_of_day === "morning" ||
    event.time_of_day === "afternoon" ||
    event.time_of_day === "evening" ||
    event.time_of_day === "night"
      ? event.time_of_day
      : null;

  if (!timeOfDay) {
    return;
  }

  ctx.setState((state) => ({
    statusMessage: `Time of day changed to ${timeOfDay}`,
    timeOfDay,
    weather: {
      ...state.weather,
      ambientC: AMBIENT_BY_TIME[timeOfDay],
      ramp: null,
    },
  }));

  ctx.addLog(`Time-of-day changed to ${timeOfDay}`, "info");
}
