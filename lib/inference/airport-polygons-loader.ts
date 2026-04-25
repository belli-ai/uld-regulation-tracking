type AirportPolygonZoneName =
  | "cool-room"
  | "build-up-area"
  | "apron-staging-1"
  | "apron-staging-2"
  | "tarmac-shadow-jetbridge"
  | "tarmac-shadow-tail"
  | "gate-A12";

export type AirportZoneName = AirportPolygonZoneName | "runway-25R";

type Coordinate = [longitude: number, latitude: number];

type AirportZoneBase = {
  id: AirportZoneName;
  name: string;
  purpose: string;
  referenceAmbientC: number | null;
  referenceAmbientDeltaC: number | null;
};

export type AirportPolygonZone = AirportZoneBase & {
  kind: "polygon";
  coordinates: Coordinate[][];
};

export type AirportLineZone = AirportZoneBase & {
  kind: "line";
  coordinates: Coordinate[];
};

export type AirportZone = AirportPolygonZone | AirportLineZone;

type AirportBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

export type AirportPolygons = {
  airportCode: "DXB";
  zones: Record<AirportZoneName, AirportZone>;
  polygonZoneNames: AirportPolygonZoneName[];
  bounds: AirportBounds;
};

type RawFeatureCollection = {
  type?: unknown;
  features?: unknown;
};

type RawFeature = {
  id?: unknown;
  properties?: unknown;
  geometry?: unknown;
};

type RawFeatureProperties = {
  name?: unknown;
  purpose?: unknown;
  referenceAmbientC?: unknown;
  referenceAmbientDeltaC?: unknown;
};

type RawGeometry = {
  type?: unknown;
  coordinates?: unknown;
};

const POLYGON_ZONE_NAMES: AirportPolygonZoneName[] = [
  "cool-room",
  "build-up-area",
  "apron-staging-1",
  "apron-staging-2",
  "tarmac-shadow-jetbridge",
  "tarmac-shadow-tail",
  "gate-A12",
];

const ALL_ZONE_NAMES: AirportZoneName[] = [...POLYGON_ZONE_NAMES, "runway-25R"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`airport-polygons-loader: invalid '${field}'`);
  }
  return value;
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`airport-polygons-loader: invalid '${field}'`);
  }
  return value;
}

function asZoneName(value: unknown): AirportZoneName {
  if (
    typeof value === "string" &&
    ALL_ZONE_NAMES.includes(value as AirportZoneName)
  ) {
    return value as AirportZoneName;
  }
  throw new Error("airport-polygons-loader: unknown sub-zone id");
}

function asCoordinate(value: unknown, field: string): Coordinate {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    throw new Error(`airport-polygons-loader: invalid '${field}' coordinate`);
  }
  return [value[0], value[1]];
}

function asPolygonCoordinates(value: unknown, field: string): Coordinate[][] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`airport-polygons-loader: invalid '${field}' polygon`);
  }
  return value.map((ring, ringIndex) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new Error(`airport-polygons-loader: invalid '${field}' ring`);
    }
    return ring.map((coordinate, coordinateIndex) =>
      asCoordinate(
        coordinate,
        `${field}.coordinates[${ringIndex}][${coordinateIndex}]`,
      ),
    );
  });
}

function asLineCoordinates(value: unknown, field: string): Coordinate[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`airport-polygons-loader: invalid '${field}' line`);
  }
  return value.map((coordinate, index) =>
    asCoordinate(coordinate, `${field}.coordinates[${index}]`),
  );
}

function toZoneBase(rawFeature: RawFeature, index: number): AirportZoneBase {
  const properties = isRecord(rawFeature.properties)
    ? (rawFeature.properties as RawFeatureProperties)
    : {};
  return {
    id: asZoneName(rawFeature.id),
    name: asString(properties.name, `features[${index}].properties.name`),
    purpose: asString(
      properties.purpose,
      `features[${index}].properties.purpose`,
    ),
    referenceAmbientC: asNullableNumber(
      properties.referenceAmbientC,
      `features[${index}].properties.referenceAmbientC`,
    ),
    referenceAmbientDeltaC: asNullableNumber(
      properties.referenceAmbientDeltaC,
      `features[${index}].properties.referenceAmbientDeltaC`,
    ),
  };
}

function toZone(rawFeature: RawFeature, index: number): AirportZone {
  const zoneBase = toZoneBase(rawFeature, index);
  const geometry = isRecord(rawFeature.geometry)
    ? (rawFeature.geometry as RawGeometry)
    : null;

  if (!geometry || typeof geometry.type !== "string") {
    throw new Error(`airport-polygons-loader: missing geometry at index ${index}`);
  }

  if (geometry.type === "Polygon") {
    return {
      ...zoneBase,
      kind: "polygon",
      coordinates: asPolygonCoordinates(
        geometry.coordinates,
        `features[${index}].geometry`,
      ),
    };
  }

  if (geometry.type === "LineString") {
    return {
      ...zoneBase,
      kind: "line",
      coordinates: asLineCoordinates(
        geometry.coordinates,
        `features[${index}].geometry`,
      ),
    };
  }

  throw new Error(
    `airport-polygons-loader: unsupported geometry '${geometry.type}' at index ${index}`,
  );
}

function computeBounds(zones: Record<AirportZoneName, AirportZone>): AirportBounds {
  const coordinates = Object.values(zones).flatMap((zone) =>
    zone.kind === "polygon"
      ? zone.coordinates.flatMap((ring) => ring)
      : zone.coordinates,
  );

  return coordinates.reduce<AirportBounds>(
    (bounds, [longitude, latitude]) => ({
      minLatitude: Math.min(bounds.minLatitude, latitude),
      maxLatitude: Math.max(bounds.maxLatitude, latitude),
      minLongitude: Math.min(bounds.minLongitude, longitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
    }),
    {
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
    },
  );
}

function assertCompleteZoneMap(
  zoneMap: Partial<Record<AirportZoneName, AirportZone>>,
): asserts zoneMap is Record<AirportZoneName, AirportZone> {
  for (const zoneName of ALL_ZONE_NAMES) {
    if (!zoneMap[zoneName]) {
      throw new Error(`airport-polygons-loader: missing '${zoneName}'`);
    }
  }
}

export function parseAirportPolygons(raw: unknown): AirportPolygons {
  const collection = isRecord(raw) ? (raw as RawFeatureCollection) : null;
  if (!collection || collection.type !== "FeatureCollection") {
    throw new Error("airport-polygons-loader: expected a FeatureCollection");
  }
  if (!Array.isArray(collection.features)) {
    throw new Error("airport-polygons-loader: missing features array");
  }

  const zoneMap: Partial<Record<AirportZoneName, AirportZone>> = {};

  collection.features.forEach((feature, index) => {
    const parsedFeature = isRecord(feature) ? (feature as RawFeature) : null;
    if (!parsedFeature) {
      throw new Error(`airport-polygons-loader: invalid feature at index ${index}`);
    }
    const zone = toZone(parsedFeature, index);
    zoneMap[zone.id] = zone;
  });

  assertCompleteZoneMap(zoneMap);

  return {
    airportCode: "DXB",
    zones: zoneMap,
    polygonZoneNames: POLYGON_ZONE_NAMES,
    bounds: computeBounds(zoneMap),
  };
}

export async function loadAirportPolygons(): Promise<AirportPolygons> {
  const response = await fetch("/data/airports/DXB.geojson", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `airport-polygons-loader: failed to load DXB.geojson (${response.status})`,
    );
  }
  return parseAirportPolygons((await response.json()) as unknown);
}
