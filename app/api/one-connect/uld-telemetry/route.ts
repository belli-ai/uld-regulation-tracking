import {
  getLogisticsObject,
  isOneConnectEnabled,
  pollNotifications,
} from "@/lib/adapters/one-connect/client";
import { notificationsToMeasurements } from "@/lib/adapters/one-connect/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isOneConnectEnabled()) {
    return Response.json({ enabled: false, byUld: {}, bySensor: {}, total: 0 });
  }

  try {
    const notifications = await pollNotifications({ limit: 100 });
    const batch = await notificationsToMeasurements(notifications, async (uri) =>
      getLogisticsObject(uri, { embedded: true }),
    );

    return Response.json({
      enabled: true,
      byUld: batch.byUld,
      bySensor: batch.bySensor,
      total: batch.measurements.length,
    });
  } catch {
    return Response.json(
      { enabled: true, byUld: {}, bySensor: {}, total: 0 },
      { status: 502 },
    );
  }
}
