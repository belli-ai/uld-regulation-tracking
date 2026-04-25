import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleAlert(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const title =
    typeof event.title === "string" ? event.title : "In-app alert";
  const body =
    typeof event.body === "string" ? event.body : "Attention required.";

  ctx.setInAppAlert({
    body,
    title,
    tone: event.severity === "critical" ? "critical" : "warning",
  });
  ctx.addLog(`Alert displayed: ${title}`, "warning");
}
