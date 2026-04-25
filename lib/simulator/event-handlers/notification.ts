import { fireWebNotification } from "@/lib/notifications/web-notify";
import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleNotification(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  if (typeof event.title !== "string") {
    return;
  }

  const body = typeof event.body === "string" ? event.body : "";
  ctx.setState({
    browserNotification: {
      body,
      title: event.title,
      uldId: typeof event.uldId === "string" ? event.uldId : null,
    },
    statusMessage: event.title,
  });

  if (ctx.getState().notificationsEnabled) {
    await fireWebNotification({
      body,
      data:
        typeof event.uldId === "string"
          ? { href: `/uld/${event.uldId}` }
          : undefined,
      tag:
        typeof event.uldId === "string" ? `demo-${event.uldId}` : "demo-notification",
      title: event.title,
    });
  }

  ctx.addLog(`Notification fired: ${event.title}`, "warning");
}
