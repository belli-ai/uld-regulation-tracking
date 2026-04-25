import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleScenarioEnd(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  ctx.pauseClock();
  ctx.clearWaitState();
  ctx.setState({
    lastScenarioSummary:
      typeof event.summary === "string"
        ? event.summary
        : `Scenario finished at t=${ctx.stores.demoClock.getState().currentTickSec}s`,
    statusMessage: "Scenario complete",
  });
  ctx.addLog(`Scenario ended: ${ctx.currentScenario.id}`, "success");
}
