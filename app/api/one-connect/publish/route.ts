import {
  isOneConnectEnabled,
  postLogisticsObject,
} from "@/lib/adapters/one-connect/client";
import { compactToExpanded } from "@/lib/adapters/one-connect/json-ld";

export const dynamic = "force-dynamic";

type PublishKind = "Loading" | "LogisticsEvent" | "LogisticsAction";
type JsonObject = Record<string, unknown>;

const PUBLISH_KINDS = new Set<PublishKind>([
  "Loading",
  "LogisticsEvent",
  "LogisticsAction",
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublishKind(value: unknown): value is PublishKind {
  return typeof value === "string" && PUBLISH_KINDS.has(value as PublishKind);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "one-connect publish failed";
}

export async function POST(req: Request) {
  if (!isOneConnectEnabled()) {
    return Response.json({ ok: true, mode: "stub" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const kind = isObject(body) ? body.kind : undefined;
  if (!isPublishKind(kind)) {
    return Response.json({ error: "invalid publish kind" }, { status: 400 });
  }

  const payload = isObject(body) && isObject(body.payload) ? { ...body.payload } : {};
  if (typeof payload["@type"] !== "string") {
    payload["@type"] = kind;
  }

  try {
    const jsonld = compactToExpanded(payload);
    const result = await postLogisticsObject(jsonld);
    return Response.json({
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      "@id": result["@id"] ?? null,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
