import { NextRequest } from "next/server";
import {
  isOneConnectEnabled,
  pollNotifications,
} from "@/lib/adapters/one-connect/client";
import { IRI } from "@/lib/adapters/one-connect/json-ld";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localName(value: string): string {
  const hashIndex = value.lastIndexOf("#");
  const slashIndex = value.lastIndexOf("/");
  const colonIndex = value.lastIndexOf(":");
  return value.slice(Math.max(hashIndex, slashIndex, colonIndex) + 1);
}

function logisticsObjectType(notification: unknown): string | null {
  if (!isObject(notification)) return null;
  const rawType = notification[IRI.hasLogisticsObjectType];
  if (typeof rawType === "string") return localName(rawType);
  if (isObject(rawType) && typeof rawType["@id"] === "string") {
    return localName(rawType["@id"]);
  }
  return null;
}

function readLimit(req: NextRequest): number {
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) return 50;
  return Math.min(Math.floor(rawLimit), 200);
}

function readTypes(req: NextRequest): Set<string> {
  return new Set(
    (req.nextUrl.searchParams.get("types") ?? "")
      .split(",")
      .map((type) => type.trim())
      .filter(Boolean),
  );
}

export async function GET(req: NextRequest) {
  const limit = readLimit(req);
  const typesFilter = readTypes(req);

  if (!isOneConnectEnabled()) {
    return Response.json({ enabled: false, notifications: [] });
  }

  try {
    const notifications = await pollNotifications({ limit });
    const filtered =
      typesFilter.size === 0
        ? notifications
        : notifications.filter((notification) => {
            const type = logisticsObjectType(notification);
            return type ? typesFilter.has(type) : false;
          });

    return Response.json({ enabled: true, notifications: filtered });
  } catch {
    return Response.json(
      { enabled: true, notifications: [] },
      { status: 502 },
    );
  }
}
