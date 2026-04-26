import { toast } from "sonner";

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

  const osGranted =
    ctx.getState().notificationsEnabled &&
    typeof window !== "undefined" &&
    Notification.permission === "granted";

  if (osGranted) {
    await fireWebNotification({
      body,
      data:
        typeof event.uldId === "string"
          ? { href: `/uld/${event.uldId}` }
          : undefined,
      tag:
        typeof event.uldId === "string"
          ? `demo-${event.uldId}`
          : "demo-notification",
      title: event.title,
    });
  } else {
    toast(event.title, {
      description: body,
      action:
        typeof event.uldId === "string"
          ? {
              label: "Open ULD",
              onClick: () =>
                window.location.assign(`/uld/${event.uldId as string}`),
            }
          : undefined,
    });
  }

  ctx.addLog(`Notification fired: ${event.title}`, "warning");
}
