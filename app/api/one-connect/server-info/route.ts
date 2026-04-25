import {
  getServerInformation,
  isOneConnectEnabled,
} from "@/lib/adapters/one-connect/client";
import { IRI, NS } from "@/lib/adapters/one-connect/json-ld";

export const dynamic = "force-dynamic";

const HAS_DATA_HOLDER = `${NS.api}hasDataHolder`;
const ONTOLOGY = `${NS.api}hasSupportedOntology`;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(stringValues);
  }
  if (typeof value === "string") {
    return [value];
  }
  if (isObject(value)) {
    if (typeof value["@id"] === "string") return [value["@id"]];
    if (typeof value["@value"] === "string") return [value["@value"]];
  }
  return [];
}

function firstString(value: unknown): string | null {
  return stringValues(value)[0] ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "one-connect server-info failed";
}

export async function GET() {
  if (!isOneConnectEnabled()) {
    return Response.json({ enabled: false });
  }

  try {
    const info = await getServerInformation();
    const data = isObject(info) ? info : {};

    return Response.json({
      enabled: true,
      ontology: stringValues(data[ONTOLOGY]),
      hasDataHolder: firstString(data[HAS_DATA_HOLDER]),
      lastModified: firstString(data[IRI.lastModified]),
    });
  } catch (error) {
    return Response.json(
      { enabled: true, error: errorMessage(error) },
      { status: 502 },
    );
  }
}
