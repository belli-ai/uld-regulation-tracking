import { type Piece, type Waybill, toIRI } from "@/lib/ontology/one-record";
import {
  IRI,
  coerceValue,
  extractId,
  extractType,
  irefOrEmbedded,
} from "@/lib/adapters/one-connect/json-ld";

type JsonObject = Record<string, unknown>;
type FetchEmbedded = (iri: string) => Promise<unknown>;
type WalkContext = { depth?: number };

type WaybillBatch = { waybills: Waybill[]; pieces: Piece[] };

const MAX_DEPTH = 6;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return typeof value === "undefined" || value === null ? [] : [value];
}

function firstValue(node: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    const value = node[key];
    if (typeof value !== "undefined") return value;
  }
  return undefined;
}

function fragment(value: string): string {
  const hashIndex = value.lastIndexOf("#");
  const slashIndex = value.lastIndexOf("/");
  const colonIndex = value.lastIndexOf(":");
  return value.slice(Math.max(hashIndex, slashIndex, colonIndex) + 1);
}

function referenceIri(value: unknown): string | null {
  const reference = irefOrEmbedded(value);
  return reference?.kind === "iri" ? reference.iri : null;
}

function referenceEmbedded(value: unknown): JsonObject | null {
  const reference = irefOrEmbedded(value);
  return reference?.kind === "embedded" ? reference.value : null;
}

function logisticsObjectType(notification: unknown): string | null {
  if (!isObject(notification)) return null;
  const ownType = extractType(notification);
  if (ownType && fragment(ownType) === "Waybill") return "Waybill";
  const rawType = firstValue(notification, [
    "hasLogisticsObjectType",
    "api:hasLogisticsObjectType",
    IRI.hasLogisticsObjectType,
  ]);
  if (typeof rawType === "string") return fragment(rawType);
  if (isObject(rawType) && typeof rawType["@id"] === "string") {
    return fragment(rawType["@id"]);
  }
  return null;
}

function notificationTarget(notification: unknown): { iri?: string; embedded?: JsonObject } | null {
  if (!isObject(notification)) return null;
  const logisticsObject = firstValue(notification, [
    "hasLogisticsObject",
    "api:hasLogisticsObject",
    IRI.hasLogisticsObject,
  ]);
  const reference = irefOrEmbedded(logisticsObject);
  if (reference?.kind === "iri") return { iri: reference.iri };
  if (reference?.kind === "embedded") return { embedded: reference.value };
  const id = extractId(notification);
  return id ? { iri: id } : { embedded: notification };
}

async function resolveNotificationTarget(
  notification: unknown,
  fetchEmbedded: FetchEmbedded,
): Promise<unknown | null> {
  const target = notificationTarget(notification);
  if (!target) return null;
  if (target.embedded) return target.embedded;
  if (!target.iri) return null;
  try {
    return await fetchEmbedded(target.iri);
  } catch {
    return null;
  }
}

function splitWaybillNumber(value: string): { prefix: string; number: string } | null {
  const [prefix, ...rest] = value.split("-");
  const number = rest.join("-");
  if (prefix.length === 0 || number.length === 0) return null;
  return { prefix, number };
}

function firstSpecialHandlingCode(value: unknown): string {
  const first = asArray(value)[0];
  if (typeof first === "string") return fragment(first);
  if (isObject(first) && typeof first["@id"] === "string") {
    return fragment(first["@id"]);
  }
  return "";
}

function dimensionValue(node: JsonObject, key: "length" | "width" | "height"): number | null {
  const value = coerceValue(firstValue(node, [key, `cargo:${key}`, IRI[key]]));
  if (!value || !Number.isFinite(value.value)) return null;
  if (value.unit !== "" && value.unit !== "cm") {
    console.warn(`one-connect waybill adapter: expected ${key} in cm, received ${value.unit}`);
  }
  return value.value;
}

function dimensionsValue(value: unknown): Piece["dimensions"] | undefined {
  if (!isObject(value)) return undefined;
  const length = dimensionValue(value, "length");
  const width = dimensionValue(value, "width");
  const height = dimensionValue(value, "height");
  if (length === null || width === null || height === null) return undefined;
  return { length, width, height, unit: "cm" };
}

function pieceGrossWeight(node: JsonObject): Piece["grossWeight"] {
  const grossWeight = coerceValue(
    firstValue(node, ["grossWeight", "totalGrossWeight", "cargo:totalGrossWeight", IRI.totalGrossWeight]),
  );
  if (grossWeight?.unit === "lb") return { value: grossWeight.value, unit: "lb" };
  if (grossWeight?.unit !== "" && grossWeight?.unit !== "kg" && grossWeight) {
    console.warn(`one-connect waybill adapter: expected piece weight in kg/lb, received ${grossWeight.unit}`);
  }
  return { value: grossWeight?.value ?? 0, unit: "kg" };
}

function resolvePieces(node: JsonObject): Piece[] {
  const masterWaybill = referenceEmbedded(
    firstValue(node, ["masterWaybill", "cargo:masterWaybill", IRI.masterWaybill]),
  );
  const shipment =
    referenceEmbedded(firstValue(node, ["shipment", "cargo:shipment", IRI.shipment])) ??
    (masterWaybill
      ? referenceEmbedded(firstValue(masterWaybill, ["shipment", "cargo:shipment", IRI.shipment]))
      : null);
  if (!shipment) return [];
  return asArray(firstValue(shipment, ["pieces", "cargo:pieces", IRI.pieces]))
    .map((piece) => referenceEmbedded(piece) ?? piece)
    .map((piece) => adaptOneConnectPiece(piece))
    .filter((piece): piece is Piece => piece !== null);
}

function walkWaybills(node: unknown, ctx: WalkContext = {}): Waybill[] {
  if (!isObject(node)) return [];
  const depth = ctx.depth ?? 0;
  if (depth > MAX_DEPTH) return [];

  const type = extractType(node);
  if (type && fragment(type) === "Waybill") {
    const waybill = adaptOneConnectWaybill(node);
    const masterWaybill = referenceEmbedded(
      firstValue(node, ["masterWaybill", "cargo:masterWaybill", IRI.masterWaybill]),
    );
    return [
      ...(waybill ? [waybill] : []),
      ...walkWaybills(masterWaybill, { depth: depth + 1 }),
    ];
  }

  return [];
}

export function adaptOneConnectPiece(node: unknown): Piece | null {
  if (!isObject(node)) return null;
  const id = extractId(node);
  const ofShipment = referenceIri(firstValue(node, ["ofShipment", "cargo:ofShipment", IRI.ofShipment]));
  if (!id || !ofShipment) return null;

  const piece: Piece = {
    "@id": toIRI(id),
    "@type": "Piece",
    grossWeight: pieceGrossWeight(node),
    ofShipment: toIRI(ofShipment),
  };

  const dimensions = dimensionsValue(
    firstValue(node, ["dimensions", "cargo:dimensions", IRI.dimensions]),
  );
  if (dimensions) piece.dimensions = dimensions;

  const fulfillsUldTypeCode = firstValue(node, [
    "fulfillsUldTypeCode",
    "cargo:fulfillsUldTypeCode",
    IRI.fulfillsUldTypeCode,
  ]);
  if (typeof fulfillsUldTypeCode === "string" && fulfillsUldTypeCode.length > 0) {
    piece.fulfillsUldTypeCode = fulfillsUldTypeCode;
  }

  return piece;
}

export function adaptOneConnectWaybill(node: unknown): Waybill | null {
  if (!isObject(node)) return null;
  const id = extractId(node);
  const rawWaybillNumber = firstValue(node, [
    "waybillNumber",
    "cargo:waybillNumber",
    IRI.waybillNumber,
  ]);
  if (!id || typeof rawWaybillNumber !== "string") return null;
  const split = splitWaybillNumber(rawWaybillNumber);
  if (!split) return null;

  const arrivalLocation =
    referenceIri(firstValue(node, ["arrivalLocation", "cargo:arrivalLocation", IRI.arrivalLocation])) ??
    "";
  const departureLocation =
    referenceIri(firstValue(node, ["departureLocation", "cargo:departureLocation", IRI.departureLocation])) ??
    "";
  const pieces = resolvePieces(node);

  return {
    "@id": toIRI(id),
    "@type": "Waybill",
    waybillPrefix: split.prefix,
    waybillNumber: split.number,
    arrivalLocation: toIRI(arrivalLocation),
    departureLocation: toIRI(departureLocation),
    shc: firstSpecialHandlingCode(
      firstValue(node, [
        "specialHandlingCodes",
        "cargo:specialHandlingCodes",
        IRI.specialHandlingCodes,
      ]),
    ),
    pieces,
  };
}

export async function notificationsToWaybills(
  notifications: unknown[],
  fetchEmbedded: FetchEmbedded,
): Promise<WaybillBatch> {
  const waybills: Waybill[] = [];
  const pieces: Piece[] = [];
  const seenWaybills = new Set<string>();
  const seenPieces = new Set<string>();

  for (const notification of notifications) {
    const type = logisticsObjectType(notification);
    if (type !== "Waybill") continue;
    const target = await resolveNotificationTarget(notification, fetchEmbedded);
    const entries = walkWaybills(target);

    for (const waybill of entries) {
      if (seenWaybills.has(waybill["@id"])) continue;
      seenWaybills.add(waybill["@id"]);
      waybills.push(waybill);
      for (const piece of waybill.pieces) {
        if (seenPieces.has(piece["@id"])) continue;
        seenPieces.add(piece["@id"]);
        pieces.push(piece);
      }
    }
  }

  return { waybills, pieces };
}
