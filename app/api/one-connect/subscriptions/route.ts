import {
  createSubscription,
  isOneConnectEnabled,
} from "@/lib/adapters/one-connect/client";
import { IRI } from "@/lib/adapters/one-connect/json-ld";

export const dynamic = "force-dynamic";

const TOPICS = [
  IRI.ULD,
  IRI.Measurement,
  IRI.Sensor,
  IRI.IotDevice,
  IRI.Waybill,
] as const;

export async function POST() {
  if (!isOneConnectEnabled()) {
    return Response.json({ enabled: false });
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const topic of TOPICS) {
    try {
      const result = await createSubscription(topic);
      if (result.created) {
        created.push(topic);
      } else if (result.status === 409) {
        skipped.push(topic);
      } else {
        failed.push(topic);
      }
    } catch {
      failed.push(topic);
    }
  }

  return Response.json({ enabled: true, created, skipped, failed });
}
