import { toIRI, type Piece, type Waybill } from "@/lib/ontology/one-record";

type RawDimensions = {
  length?: unknown;
  width?: unknown;
  height?: unknown;
  unit?: unknown;
};

type RawWeight = {
  value?: unknown;
  unit?: unknown;
};

type RawPiece = {
  "@id"?: unknown;
  grossWeight?: unknown;
  dimensions?: unknown;
  ofShipment?: unknown;
  inPiece?: unknown;
  fulfillsUldTypeCode?: unknown;
  customsInformation?: unknown;
  containedItems?: unknown;
};

type RawWaybill = {
  "@id"?: unknown;
  waybillPrefix?: unknown;
  waybillNumber?: unknown;
  arrivalLocation?: unknown;
  departureLocation?: unknown;
  declaredValueForCarriage?: unknown;
  shipmentDetails?: unknown;
  shc?: unknown;
  pieces?: unknown;
};

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`shipments adapter: missing or invalid '${field}'`);
  }
  return value;
}

function adaptWeight(value: unknown): Piece["grossWeight"] {
  const raw = value as RawWeight;
  const numeric = Number(raw?.value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`shipments adapter: invalid grossWeight.value`);
  }
  const unit = raw?.unit === "lb" ? "lb" : "kg";
  return { value: numeric, unit };
}

function adaptDimensions(value: unknown): Piece["dimensions"] | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const raw = value as RawDimensions;
  const length = Number(raw.length);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return undefined;
  }
  return { length, width, height, unit: "cm" };
}

function adaptIriList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (entry): entry is string => typeof entry === "string",
  );
  return filtered.length ? filtered.map(toIRI) : undefined;
}

function adaptDeclaredValue(
  value: unknown,
): Waybill["declaredValueForCarriage"] | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const raw = value as { value?: unknown; currency?: unknown };
  const numeric = Number(raw.value);
  if (
    !Number.isFinite(numeric) ||
    typeof raw.currency !== "string" ||
    raw.currency.length === 0
  ) {
    return undefined;
  }
  return { value: numeric, currency: raw.currency };
}

export function adaptOnePiece(raw: RawPiece): Piece {
  const piece: Piece = {
    "@id": toIRI(asString(raw["@id"], "piece.@id")),
    "@type": "Piece",
    grossWeight: adaptWeight(raw.grossWeight),
    ofShipment: toIRI(asString(raw.ofShipment, "piece.ofShipment")),
  };
  const dimensions = adaptDimensions(raw.dimensions);
  if (dimensions) piece.dimensions = dimensions;
  if (typeof raw.inPiece === "string" && raw.inPiece.length > 0) {
    piece.inPiece = toIRI(raw.inPiece);
  }
  if (
    typeof raw.fulfillsUldTypeCode === "string" &&
    raw.fulfillsUldTypeCode.length > 0
  ) {
    piece.fulfillsUldTypeCode = raw.fulfillsUldTypeCode;
  }
  const customs = adaptIriList(raw.customsInformation);
  if (customs) piece.customsInformation = customs;
  const contained = adaptIriList(raw.containedItems);
  if (contained) piece.containedItems = contained;
  return piece;
}

export function adaptOneWaybill(raw: RawWaybill): Waybill {
  const pieces = Array.isArray(raw.pieces)
    ? raw.pieces.map((piece) => adaptOnePiece(piece as RawPiece))
    : [];
  const waybill: Waybill = {
    "@id": toIRI(asString(raw["@id"], "waybill.@id")),
    "@type": "Waybill",
    waybillPrefix: asString(raw.waybillPrefix, "waybillPrefix"),
    waybillNumber: asString(raw.waybillNumber, "waybillNumber"),
    arrivalLocation: toIRI(
      asString(raw.arrivalLocation, "waybill.arrivalLocation"),
    ),
    departureLocation: toIRI(
      asString(raw.departureLocation, "waybill.departureLocation"),
    ),
    shc: typeof raw.shc === "string" ? raw.shc : "",
    pieces,
  };
  const declared = adaptDeclaredValue(raw.declaredValueForCarriage);
  if (declared) waybill.declaredValueForCarriage = declared;
  if (
    typeof raw.shipmentDetails === "string" &&
    raw.shipmentDetails.length > 0
  ) {
    waybill.shipmentDetails = toIRI(raw.shipmentDetails);
  }
  return waybill;
}

export function adaptMockShipmentsForFlight(
  raw: unknown,
  flightNumber: string,
): Waybill[] {
  if (raw == null || typeof raw !== "object") return [];
  const map = raw as Record<string, unknown>;
  const list = map[flightNumber];
  if (!Array.isArray(list)) return [];
  return list.map((entry) => adaptOneWaybill(entry as RawWaybill));
}

export function adaptAllMockShipments(raw: unknown): Record<string, Waybill[]> {
  if (raw == null || typeof raw !== "object") return {};
  const map = raw as Record<string, unknown>;
  const out: Record<string, Waybill[]> = {};
  for (const [flightNumber, list] of Object.entries(map)) {
    if (!Array.isArray(list)) continue;
    out[flightNumber] = list.map((entry) =>
      adaptOneWaybill(entry as RawWaybill),
    );
  }
  return out;
}
