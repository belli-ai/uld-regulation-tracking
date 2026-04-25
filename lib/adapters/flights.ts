import { toIRI, type TransportMovement } from "@/lib/ontology/one-record";

type RawMovementTime = {
  type?: unknown;
  timestamp?: unknown;
};

type RawFlight = {
  "@id"?: unknown;
  flightNumber?: unknown;
  departureLocation?: unknown;
  arrivalLocation?: unknown;
  movementTimes?: unknown;
  operatingParties?: unknown;
  loadingActions?: unknown;
};

const ALLOWED_TIME_TYPES = new Set(["STD", "STA", "ATD", "ATA"]);

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`flights adapter: missing or invalid '${field}'`);
  }
  return value;
}

function adaptMovementTimes(
  value: unknown,
): TransportMovement["movementTimes"] {
  if (!Array.isArray(value)) return [];
  const out: TransportMovement["movementTimes"] = [];
  for (const entry of value as RawMovementTime[]) {
    const type = entry?.type;
    const timestamp = entry?.timestamp;
    if (
      typeof type !== "string" ||
      typeof timestamp !== "string" ||
      !ALLOWED_TIME_TYPES.has(type)
    ) {
      continue;
    }
    out.push({
      type: type as "STD" | "STA" | "ATD" | "ATA",
      timestamp,
    });
  }
  return out;
}

function adaptIriList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map(toIRI);
}

export function adaptOneFlight(raw: RawFlight): TransportMovement {
  return {
    "@id": toIRI(asString(raw["@id"], "@id")),
    "@type": "TransportMovement",
    modeCode: "Air",
    flightNumber: asString(raw.flightNumber, "flightNumber"),
    departureLocation: toIRI(
      asString(raw.departureLocation, "departureLocation"),
    ),
    arrivalLocation: toIRI(asString(raw.arrivalLocation, "arrivalLocation")),
    movementTimes: adaptMovementTimes(raw.movementTimes),
    operatingParties: adaptIriList(raw.operatingParties),
    loadingActions: adaptIriList(raw.loadingActions),
  };
}

export function adaptMockFlights(raw: unknown): TransportMovement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => adaptOneFlight(entry as RawFlight));
}
