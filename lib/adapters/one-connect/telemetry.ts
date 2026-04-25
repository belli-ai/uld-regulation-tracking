import { type IRI as OneRecordIri, type Measurement, toIRI } from "@/lib/ontology/one-record";
import {
  IRI,
  coerceValue,
  extractId,
  extractType,
  irefOrEmbedded,
} from "@/lib/adapters/one-connect/json-ld";

type JsonObject = Record<string, unknown>;
type FetchEmbedded = (iri: string) => Promise<unknown>;
type WalkContext = {
  depth?: number;
  maxDepth?: number;
  uldIri?: string;
  ownerSensorIri?: string;
};
type NotificationsToMeasurementsOptions = { maxDepth?: number };
type MeasurementWalkResult = {
  measurement: Measurement;
  uldIri?: OneRecordIri;
  sensorIri: OneRecordIri;
};
type MeasurementsBatch = {
  measurements: Measurement[];
  byUld: Record<string, Measurement[]>;
  bySensor: Record<string, Measurement[]>;
};

const MEASUREMENT_NOTIFICATION_TYPES = new Set([
  "ULD",
  "Sensor",
  "IotDevice",
  "Measurement",
]);
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

function referenceIri(value: unknown): string | null {
  const reference = irefOrEmbedded(value);
  return reference?.kind === "iri" ? reference.iri : null;
}

function referenceEmbedded(value: unknown): JsonObject | null {
  const reference = irefOrEmbedded(value);
  return reference?.kind === "embedded" ? reference.value : null;
}

function localName(value: string): string {
  const hashIndex = value.lastIndexOf("#");
  const slashIndex = value.lastIndexOf("/");
  const colonIndex = value.lastIndexOf(":");
  return value.slice(Math.max(hashIndex, slashIndex, colonIndex) + 1);
}

function timestampValue(value: unknown): string | null {
  const rawValue = isObject(value) ? value["@value"] : value;
  if (typeof rawValue !== "string" || rawValue.length === 0) return null;
  const timestamp = new Date(rawValue);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function geolocationValue(value: unknown): Measurement["recordedGeolocation"] | undefined {
  if (!isObject(value)) return undefined;
  const latitude = Number(firstValue(value, ["latitude", "cargo:latitude", `${IRI.recordedGeolocation}latitude`]) ?? value["https://onerecord.iata.org/ns/cargo#latitude"]);
  const longitude = Number(firstValue(value, ["longitude", "cargo:longitude", `${IRI.recordedGeolocation}longitude`]) ?? value["https://onerecord.iata.org/ns/cargo#longitude"]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { latitude, longitude };
}

function logisticsObjectType(notification: unknown): string | null {
  if (!isObject(notification)) return null;
  const ownType = extractType(notification);
  if (ownType && MEASUREMENT_NOTIFICATION_TYPES.has(localName(ownType))) {
    return localName(ownType);
  }
  const rawType = firstValue(notification, [
    "hasLogisticsObjectType",
    "api:hasLogisticsObjectType",
    IRI.hasLogisticsObjectType,
  ]);
  if (typeof rawType === "string") {
    return localName(rawType);
  }
  if (isObject(rawType) && typeof rawType["@id"] === "string") {
    return localName(rawType["@id"]);
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

function addIndexedMeasurement(
  batch: MeasurementsBatch,
  entry: MeasurementWalkResult,
): void {
  batch.measurements.push(entry.measurement);
  const sensorKey = entry.sensorIri;
  batch.bySensor[sensorKey] = [...(batch.bySensor[sensorKey] ?? []), entry.measurement];
  if (entry.uldIri) {
    const uldKey = entry.uldIri;
    batch.byUld[uldKey] = [...(batch.byUld[uldKey] ?? []), entry.measurement];
  }
}

export function adaptOneConnectMeasurement(
  node: unknown,
  ctx: Pick<WalkContext, "ownerSensorIri"> = {},
): Measurement | null {
  if (!isObject(node)) return null;
  const id = extractId(node);
  if (!id) return null;

  const measurementValue = coerceValue(
    firstValue(node, ["measurementValue", "cargo:measurementValue", IRI.measurementValue]),
  );
  if (!measurementValue) return null;

  const measurementTimestamp = timestampValue(
    firstValue(node, [
      "measurementTimestamp",
      "cargo:measurementTimestamp",
      IRI.measurementTimestamp,
    ]),
  );
  if (!measurementTimestamp) return null;

  const bySensor =
    referenceIri(firstValue(node, ["bySensor", "cargo:bySensor", IRI.bySensor])) ??
    ctx.ownerSensorIri;
  if (!bySensor) return null;

  const measurement: Measurement = {
    "@id": toIRI(id),
    "@type": "Measurement",
    measurementValue,
    measurementTimestamp,
    bySensor: toIRI(bySensor),
  };

  const recordedGeolocation = geolocationValue(
    firstValue(node, [
      "recordedGeolocation",
      "cargo:recordedGeolocation",
      IRI.recordedGeolocation,
    ]),
  );
  if (recordedGeolocation) measurement.recordedGeolocation = recordedGeolocation;

  return measurement;
}

export function walkMeasurements(
  node: unknown,
  ctx: WalkContext = {},
): MeasurementWalkResult[] {
  if (!isObject(node)) return [];
  const depth = ctx.depth ?? 0;
  const maxDepth = ctx.maxDepth ?? MAX_DEPTH;
  if (depth > maxDepth) return [];

  const type = extractType(node);
  const nodeType = type ? localName(type) : null;
  const id = extractId(node) ?? undefined;

  if (nodeType === "Measurement") {
    const measurement = adaptOneConnectMeasurement(node, ctx);
    if (!measurement) return [];
    return [
      {
        measurement,
        uldIri: ctx.uldIri ? toIRI(ctx.uldIri) : undefined,
        sensorIri: measurement.bySensor,
      },
    ];
  }

  if (nodeType === "ULD" || nodeType === "IotDevice") {
    const childContext = {
      ...ctx,
      depth: depth + 1,
      uldIri: nodeType === "ULD" && id ? id : ctx.uldIri,
    };
    return asArray(firstValue(node, ["sensors", "cargo:sensors", IRI.sensors])).flatMap(
      (sensor) => {
        const embedded = referenceEmbedded(sensor);
        return embedded ? walkMeasurements(embedded, childContext) : [];
      },
    );
  }

  if (nodeType === "Sensor") {
    const childContext = {
      ...ctx,
      depth: depth + 1,
      ownerSensorIri: id ?? ctx.ownerSensorIri,
    };
    return asArray(
      firstValue(node, ["measurements", "cargo:measurements", IRI.measurements]),
    ).flatMap((measurement) => {
      const embedded = referenceEmbedded(measurement);
      return embedded ? walkMeasurements(embedded, childContext) : [];
    });
  }

  return [];
}

export async function notificationsToMeasurements(
  notifications: unknown[],
  fetchEmbedded: FetchEmbedded,
  opts: NotificationsToMeasurementsOptions = {},
): Promise<MeasurementsBatch> {
  const batch: MeasurementsBatch = { measurements: [], byUld: {}, bySensor: {} };
  const seenIds = new Set<string>();

  for (const notification of notifications) {
    const type = logisticsObjectType(notification);
    if (!type || !MEASUREMENT_NOTIFICATION_TYPES.has(type)) continue;
    const target = await resolveNotificationTarget(notification, fetchEmbedded);
    const entries = walkMeasurements(target, { depth: 0, maxDepth: opts.maxDepth });

    for (const entry of entries) {
      if (seenIds.has(entry.measurement["@id"])) continue;
      seenIds.add(entry.measurement["@id"]);
      addIndexedMeasurement(batch, entry);
    }
  }

  return batch;
}
