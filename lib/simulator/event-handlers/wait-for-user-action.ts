import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleWaitForUserAction(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  if (
    typeof event.expected !== "string" ||
    typeof event.fallback_after_s !== "number"
  ) {
    return;
  }

  ctx.startWaitTimer(event.expected, event.fallback_after_s);
  ctx.setState({
    statusMessage: `Waiting for ${event.expected}`,
  });
  ctx.addLog(`Scenario paused for user action ${event.expected}`, "warning");
}
