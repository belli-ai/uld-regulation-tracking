import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleScenarioStart(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  await ctx.applyScenarioInitialState(ctx.currentScenario);
  ctx.setState({
    lastScenarioSummary: null,
    statusMessage:
      typeof event.label === "string"
        ? event.label
        : `Scenario started: ${ctx.currentScenario.name}`,
  });
  ctx.addLog(`Loaded scenario ${ctx.currentScenario.id}`, "success");
}
