type JsonObject = Record<string, unknown>;
type KnownProps = Record<string, string>;
type IriReference = { kind: "iri"; iri: string };
type EmbeddedReference = { kind: "embedded"; value: JsonObject };
type ReferenceValue = IriReference | EmbeddedReference;

export const NS = {
  api: "https://onerecord.iata.org/ns/api#",
  cargo: "https://onerecord.iata.org/ns/cargo#",
  shc: "https://onerecord.iata.org/ns/code-lists/SpecialHandlingCode#",
  unit: "https://vocabulary.uncefact.org/UnitMeasureCode#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
} as const;

export const IRI = {
  Notification: `${NS.api}Notification`,
  hasEventType: `${NS.api}hasEventType`,
  hasLogisticsObject: `${NS.api}hasLogisticsObject`,
  hasLogisticsObjectType: `${NS.api}hasLogisticsObjectType`,
  isTriggeredBy: `${NS.api}isTriggeredBy`,
  hasRevision: `${NS.api}hasRevision`,
  lastModified: `${NS.api}lastModified`,
  LOGISTICS_OBJECT_CREATED: `${NS.api}LOGISTICS_OBJECT_CREATED`,
  LOGISTICS_OBJECT_UPDATED: `${NS.api}LOGISTICS_OBJECT_UPDATED`,
  LOGISTICS_EVENT_RECEIVED: `${NS.api}LOGISTICS_EVENT_RECEIVED`,
  ULD: `${NS.cargo}ULD`,
  Piece: `${NS.cargo}Piece`,
  Waybill: `${NS.cargo}Waybill`,
  Shipment: `${NS.cargo}Shipment`,
  IotDevice: `${NS.cargo}IotDevice`,
  Sensor: `${NS.cargo}Sensor`,
  Measurement: `${NS.cargo}Measurement`,
  LogisticsEvent: `${NS.cargo}LogisticsEvent`,
  Loading: `${NS.cargo}Loading`,
  LogisticsAction: `${NS.cargo}LogisticsAction`,
  Value: `${NS.cargo}Value`,
  Dimensions: `${NS.cargo}Dimensions`,
  measurementValue: `${NS.cargo}measurementValue`,
  measurementTimestamp: `${NS.cargo}measurementTimestamp`,
  recordedGeolocation: `${NS.cargo}recordedGeolocation`,
  bySensor: `${NS.cargo}bySensor`,
  sensors: `${NS.cargo}sensors`,
  measurements: `${NS.cargo}measurements`,
  numericalValue: `${NS.cargo}numericalValue`,
  unit: `${NS.cargo}unit`,
  waybillNumber: `${NS.cargo}waybillNumber`,
  waybillType: `${NS.cargo}waybillType`,
  masterWaybill: `${NS.cargo}masterWaybill`,
  shipment: `${NS.cargo}shipment`,
  pieces: `${NS.cargo}pieces`,
  specialHandlingCodes: `${NS.cargo}specialHandlingCodes`,
  totalGrossWeight: `${NS.cargo}totalGrossWeight`,
  dimensions: `${NS.cargo}dimensions`,
  width: `${NS.cargo}width`,
  height: `${NS.cargo}height`,
  length: `${NS.cargo}length`,
  goodsDescription: `${NS.cargo}goodsDescription`,
  skeletonIndicator: `${NS.cargo}skeletonIndicator`,
  fulfillsUldTypeCode: `${NS.cargo}fulfillsUldTypeCode`,
  customsInformation: `${NS.cargo}customsInformation`,
  containedItems: `${NS.cargo}containedItems`,
  arrivalLocation: `${NS.cargo}arrivalLocation`,
  departureLocation: `${NS.cargo}departureLocation`,
  ofShipment: `${NS.cargo}ofShipment`,
} as const;

const UNIT_TO_SHORT = new Map<string, string>([
  ["CMT", "cm"],
  ["MTR", "m"],
  ["KGM", "kg"],
  ["LBR", "lb"],
  ["CEL", "C"],
  ["FAH", "F"],
  ["DD", "deg"],
  ["KMT", "km"],
  ["SEC", "s"],
  ["MIN", "min"],
  ["HUR", "h"],
  ["PCT", "pct"],
  ["KMH", "km/h"],
  ["MPS", "m/s"],
]);

const SHORT_TO_UNIT = new Map(
  Array.from(UNIT_TO_SHORT, ([key, value]) => [value, key]),
);

const KNOWN_REF_KEYS = new Set([
  "@id",
  "bySensor",
  "masterWaybill",
  "shipment",
  "pieces",
  "customsInformation",
  "containedItems",
  "arrivalLocation",
  "departureLocation",
  "ofShipment",
  "sensors",
  "measurements",
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fragment(value: string): string {
  const hashIndex = value.lastIndexOf("#");
  if (hashIndex >= 0) return value.slice(hashIndex + 1);
  const slashIndex = value.lastIndexOf("/");
  if (slashIndex >= 0) return value.slice(slashIndex + 1);
  return value;
}

function firstType(value: unknown): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
}

function expandType(value: string): string {
  if (value.includes(":")) return value;
  if (value in IRI) return `cargo:${value}`;
  return value;
}

function compactKey(key: string, knownProps: KnownProps): string {
  return knownProps[key] ?? key;
}

function compactOutboundKey(key: string): string {
  if (
    key.startsWith("@") ||
    key.startsWith("http://") ||
    key.startsWith("https://")
  ) {
    return key;
  }
  if (key.startsWith("api:") || key.startsWith("cargo:")) return key;
  return `cargo:${key}`;
}

function shcReference(code: string): JsonObject {
  return { "@id": `${NS.shc}${code}` };
}

function iriReference(iri: string): JsonObject {
  return { "@id": iri };
}

function isValueShape(value: JsonObject): boolean {
  return "value" in value && "unit" in value;
}

function compactToValue(value: JsonObject): JsonObject {
  return {
    "@type": "cargo:Value",
    "cargo:numericalValue": String(value.value),
    "cargo:unit": iriReference(inverseUnitIri(String(value.unit))),
  };
}

function compactNestedValue(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    if (key === "specialHandlingCodes") {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map(shcReference);
    }
    return value.map((entry) => compactNestedValue(entry, key));
  }
  if (isObject(value)) {
    if (isValueShape(value)) return compactToValue(value);
    if (typeof value["@id"] === "string" && Object.keys(value).length === 1) {
      return iriReference(value["@id"]);
    }
    return compactToExpanded(value, { includeContext: false });
  }
  if (typeof value === "string" && KNOWN_REF_KEYS.has(key)) {
    return iriReference(value);
  }
  return value;
}

export function extractType(node: unknown): string | null {
  if (!isObject(node)) return null;
  const type = firstType(node["@type"]);
  return type ? fragment(type) : null;
}

export function extractId(node: unknown): string | null {
  if (!isObject(node)) return null;
  return typeof node["@id"] === "string" ? node["@id"] : null;
}

export function expandedToCompact(
  node: unknown,
  knownProps: KnownProps,
): Record<string, unknown> {
  if (!isObject(node)) return {};
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "@type") {
      const type = firstType(value);
      compact[key] = type ? fragment(type) : value;
      continue;
    }
    compact[compactKey(key, knownProps)] = value;
  }
  return compact;
}

export function coerceValue(
  node: unknown,
): { value: number; unit: string } | null {
  if (!isObject(node)) return null;
  const rawValue =
    node[IRI.numericalValue] ??
    node["cargo:numericalValue"] ??
    node.numericalValue;
  const value = Number(rawValue);
  if (Number.isNaN(value)) return null;
  const rawUnit = node[IRI.unit] ?? node["cargo:unit"] ?? node.unit;
  return { value, unit: coerceUnit(rawUnit) };
}

export function coerceUnit(unitNode: unknown): string {
  const rawUnit =
    isObject(unitNode) && typeof unitNode["@id"] === "string"
      ? unitNode["@id"]
      : unitNode;
  if (typeof rawUnit !== "string") return "";
  if (!rawUnit.includes("#") && !rawUnit.includes("/")) return rawUnit;
  const unit = fragment(rawUnit);
  return UNIT_TO_SHORT.get(unit) ?? unit;
}

export function irefOrEmbedded(value: unknown): ReferenceValue | null {
  if (typeof value === "string" && value.length > 0) {
    return { kind: "iri", iri: value };
  }
  if (!isObject(value)) return null;
  if (typeof value["@id"] === "string" && Object.keys(value).length === 1) {
    return { kind: "iri", iri: value["@id"] };
  }
  return { kind: "embedded", value };
}

export function compactToExpanded(
  input: unknown,
  opts?: { includeContext?: boolean },
): Record<string, unknown> {
  if (!isObject(input)) return {};
  const includeContext = opts?.includeContext !== false;
  const expanded: Record<string, unknown> = includeContext
    ? { "@context": { cargo: NS.cargo, api: NS.api } }
    : {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "@context") continue;
    if (key === "@type" && typeof value === "string") {
      expanded[key] = expandType(value);
      continue;
    }
    if (key === "@id" && typeof value === "string") {
      expanded[key] = value;
      continue;
    }
    expanded[compactOutboundKey(key)] = compactNestedValue(value, key);
  }

  return expanded;
}

export function inverseUnitIri(unit: string): string {
  const code = SHORT_TO_UNIT.get(unit) ?? unit.toUpperCase();
  return `${NS.unit}${code}`;
}
