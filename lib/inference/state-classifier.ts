import inventoryData from "@/public/data/uld-inventory.json";
import {
  toIRI,
  type LogisticsEvent,
  type Measurement,
} from "@/lib/ontology/one-record";
import type {
  AirportLineZone,
  AirportPolygonZone,
  AirportPolygons,
  AirportZoneName,
} from "./airport-polygons-loader";

type Stage =
  | "in-warehouse"
  | "in-tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

type InternalSubState =
  | "cool-room"
  | "ambient"
  | "loading"
  | "staging"
  | null;

type ClassificationResult = {
  stage: Stage;
  internalSubState: InternalSubState;
  confidence: number;
  source: "measured" | "inferred";
};

type InventoryRecord = {
  "@id"?: unknown;
  uldSerialNumber?: unknown;
  iotDeviceId?: unknown;
  lastKnownLocation?: unknown;
  lastKnownInternalC?: unknown;
};

type TrackerMeasurement = Measurement & {
  altitudeM?: number;
  recordedAltitudeM?: number;
  altitude?: number;
};

type UldClassifierMemory = {
  lastStage: Stage | null;
  lastProcessedMeasurementTimestamp: string | null;
  hasCompletedFlight: boolean;
  forcedStage: Stage | null;
};

type MeasurementClassification = ClassificationResult & {
  zoneName: AirportZoneName | null;
  timestamp: string;
};

type ScenarioStateForceEvent = {
  type: "uld_state_force";
  uldId: string;
  state: Stage;
};

const DEFAULT_COOL_ROOM_C = 5;
const COOL_ROOM_DELTA_C = 3;
const RUNWAY_DISTANCE_THRESHOLD_KM = 0.18;
const DXB_FAR_BUFFER_DEGREES = 0.02;
const EARTH_RADIUS_KM = 6371;

const inventoryByUld = (() => {
  const inventory = new Map<string, InventoryRecord>();
  const entries = Array.isArray(inventoryData)
    ? (inventoryData as unknown[])
    : [];

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as InventoryRecord;
    if (typeof record.uldSerialNumber === "string" && record.uldSerialNumber.length > 0) {
      inventory.set(record.uldSerialNumber, record);
    }
  }

  return inventory;
})();

const stageMemory = new Map<string, UldClassifierMemory>();
const emittedEvents = new Map<string, LogisticsEvent[]>();

const warehouseZones = new Set<AirportZoneName>(["cool-room", "build-up-area"]);
const tarmacZones = new Set<AirportZoneName>([
  "apron-staging-1",
  "apron-staging-2",
  "tarmac-shadow-jetbridge",
  "tarmac-shadow-tail",
  "gate-A12",
  "runway-25R",
]);
const loadingZones = new Set<AirportZoneName>([
  "gate-A12",
  "tarmac-shadow-jetbridge",
]);

const stageEventCode: Record<Stage, string> = {
  "in-warehouse": "STATE_WAREHOUSE_IN",
  "in-tarmac": "STATE_TARMAC_IN",
  "in-flight": "STATE_FLIGHT_IN",
  "arrived-tarmac": "STATE_TARMAC_DEST_IN",
  "arrived-destination": "STATE_DEST_WAREHOUSE_IN",
};

const stageEventName: Record<Stage, string> = {
  "in-warehouse": "ULD entered origin warehouse",
  "in-tarmac": "ULD entered origin tarmac",
  "in-flight": "ULD entered flight phase",
  "arrived-tarmac": "ULD entered destination tarmac",
  "arrived-destination": "ULD entered destination warehouse",
};

function isGeolocatedMeasurement(
  measurement: Measurement,
): measurement is TrackerMeasurement & {
  recordedGeolocation: { latitude: number; longitude: number };
} {
  return (
    measurement.recordedGeolocation !== undefined &&
    Number.isFinite(measurement.recordedGeolocation.latitude) &&
    Number.isFinite(measurement.recordedGeolocation.longitude)
  );
}

function getOrCreateMemory(uldId: string): UldClassifierMemory {
  const existing = stageMemory.get(uldId);
  if (existing) {
    return existing;
  }
  const created: UldClassifierMemory = {
    lastStage: null,
    lastProcessedMeasurementTimestamp: null,
    hasCompletedFlight: false,
    forcedStage: null,
  };
  stageMemory.set(uldId, created);
  return created;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function sortMeasurements(
  measurements: readonly (TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  })[],
): (TrackerMeasurement & {
  recordedGeolocation: { latitude: number; longitude: number };
})[] {
  return [...measurements].sort((left, right) =>
    left.measurementTimestamp.localeCompare(right.measurementTimestamp),
  );
}

function getNewMeasurements(
  measurements: readonly (TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  })[],
  lastProcessedMeasurementTimestamp: string | null,
): (TrackerMeasurement & {
  recordedGeolocation: { latitude: number; longitude: number };
})[] {
  if (lastProcessedMeasurementTimestamp === null) {
    return [...measurements];
  }
  return measurements.filter(
    (measurement) =>
      measurement.measurementTimestamp > lastProcessedMeasurementTimestamp,
  );
}

function getAltitudeM(measurement: Measurement): number {
  const candidate = measurement as unknown as {
    altitudeM?: unknown;
    recordedAltitudeM?: unknown;
    altitude?: unknown;
  };
  for (const key of ["altitudeM", "recordedAltitudeM", "altitude"] as const) {
    const value = candidate[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function isFarFromDxb(
  latitude: number,
  longitude: number,
  polygons: AirportPolygons,
): boolean {
  const { bounds } = polygons;
  return (
    latitude < bounds.minLatitude - DXB_FAR_BUFFER_DEGREES ||
    latitude > bounds.maxLatitude + DXB_FAR_BUFFER_DEGREES ||
    longitude < bounds.minLongitude - DXB_FAR_BUFFER_DEGREES ||
    longitude > bounds.maxLongitude + DXB_FAR_BUFFER_DEGREES
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toProjectedKm(
  latitude: number,
  longitude: number,
  referenceLatitude: number,
): { x: number; y: number } {
  const latitudeRad = toRadians(latitude);
  const longitudeRad = toRadians(longitude);
  const referenceLatitudeRad = toRadians(referenceLatitude);

  return {
    x: EARTH_RADIUS_KM * longitudeRad * Math.cos(referenceLatitudeRad),
    y: EARTH_RADIUS_KM * latitudeRad,
  };
}

function isPointOnSegment(
  pointLatitude: number,
  pointLongitude: number,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): boolean {
  const tolerance = 1e-9;
  const crossProduct =
    (pointLatitude - startLatitude) * (endLongitude - startLongitude) -
    (pointLongitude - startLongitude) * (endLatitude - startLatitude);

  if (Math.abs(crossProduct) > tolerance) {
    return false;
  }

  const dotProduct =
    (pointLongitude - startLongitude) * (endLongitude - startLongitude) +
    (pointLatitude - startLatitude) * (endLatitude - startLatitude);

  if (dotProduct < -tolerance) {
    return false;
  }

  const squaredLength =
    (endLongitude - startLongitude) ** 2 + (endLatitude - startLatitude) ** 2;

  if (squaredLength === 0) {
    return (
      Math.abs(pointLatitude - startLatitude) <= tolerance &&
      Math.abs(pointLongitude - startLongitude) <= tolerance
    );
  }

  return dotProduct <= squaredLength + tolerance;
}

function isPointInRing(
  latitude: number,
  longitude: number,
  ring: readonly [number, number][],
): boolean {
  let inside = false;

  for (let index = 0; index < ring.length; index += 1) {
    const [startLongitude, startLatitude] = ring[index];
    const [endLongitude, endLatitude] = ring[(index + 1) % ring.length];

    if (
      isPointOnSegment(
        latitude,
        longitude,
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
      )
    ) {
      return true;
    }

    const intersects =
      (startLatitude > latitude) !== (endLatitude > latitude) &&
      longitude <
        ((endLongitude - startLongitude) * (latitude - startLatitude)) /
          (endLatitude - startLatitude) +
          startLongitude;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distancePointToSegmentKm(
  latitude: number,
  longitude: number,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number {
  const referenceLatitude = (latitude + startLatitude + endLatitude) / 3;
  const pointKm = toProjectedKm(latitude, longitude, referenceLatitude);
  const startKm = toProjectedKm(
    startLatitude,
    startLongitude,
    referenceLatitude,
  );
  const endKm = toProjectedKm(endLatitude, endLongitude, referenceLatitude);
  const deltaX = endKm.x - startKm.x;
  const deltaY = endKm.y - startKm.y;
  const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;

  if (segmentLengthSquared === 0) {
    return Math.hypot(pointKm.x - startKm.x, pointKm.y - startKm.y);
  }

  const projection =
    ((pointKm.x - startKm.x) * deltaX + (pointKm.y - startKm.y) * deltaY) /
    segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closestX = startKm.x + clampedProjection * deltaX;
  const closestY = startKm.y + clampedProjection * deltaY;

  return Math.hypot(pointKm.x - closestX, pointKm.y - closestY);
}

function isInsidePolygonZone(
  latitude: number,
  longitude: number,
  zone: AirportPolygonZone,
): boolean {
  const [outerRing, ...holes] = zone.coordinates;
  if (!isPointInRing(latitude, longitude, outerRing)) {
    return false;
  }

  return !holes.some((ring) => isPointInRing(latitude, longitude, ring));
}

function isNearLineZone(
  latitude: number,
  longitude: number,
  zone: AirportLineZone,
): boolean {
  let shortestDistanceKm = Number.POSITIVE_INFINITY;

  for (let index = 0; index < zone.coordinates.length - 1; index += 1) {
    const [startLongitude, startLatitude] = zone.coordinates[index];
    const [endLongitude, endLatitude] = zone.coordinates[index + 1];
    shortestDistanceKm = Math.min(
      shortestDistanceKm,
      distancePointToSegmentKm(
        latitude,
        longitude,
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
      ),
    );
  }

  return shortestDistanceKm <= RUNWAY_DISTANCE_THRESHOLD_KM;
}

function findZoneForPoint(
  latitude: number,
  longitude: number,
  polygons: AirportPolygons,
): AirportZoneName | null {
  for (const zoneName of polygons.polygonZoneNames) {
    const zone = polygons.zones[zoneName];
    if (zone.kind === "polygon" && isInsidePolygonZone(latitude, longitude, zone)) {
      return zoneName;
    }
  }

  const runwayZone = polygons.zones["runway-25R"];
  if (runwayZone.kind === "line" && isNearLineZone(latitude, longitude, runwayZone)) {
    return "runway-25R";
  }

  return null;
}

function deriveWarehouseSubState(
  zoneName: AirportZoneName | null,
  observedTempC: number,
): Extract<InternalSubState, "cool-room" | "ambient"> {
  if (zoneName === "cool-room") {
    return "cool-room";
  }
  return Math.abs(observedTempC - DEFAULT_COOL_ROOM_C) <= COOL_ROOM_DELTA_C
    ? "cool-room"
    : "ambient";
}

function deriveTarmacSubState(
  zoneName: AirportZoneName | null,
): Extract<InternalSubState, "loading" | "staging"> {
  return zoneName !== null && loadingZones.has(zoneName) ? "loading" : "staging";
}

function trailingDwellCount(
  measurements: readonly (TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  })[],
  polygons: AirportPolygons,
  zoneName: AirportZoneName | null,
): number {
  let count = 0;

  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const measurement = measurements[index];
    const measurementZone = findZoneForPoint(
      measurement.recordedGeolocation.latitude,
      measurement.recordedGeolocation.longitude,
      polygons,
    );
    const matchesZone =
      zoneName === null
        ? measurementZone === null &&
          isFarFromDxb(
            measurement.recordedGeolocation.latitude,
            measurement.recordedGeolocation.longitude,
            polygons,
          ) &&
          getAltitudeM(measurement) > 0
        : measurementZone === zoneName;

    if (!matchesZone) {
      break;
    }

    count += 1;
    if (count === 3) {
      break;
    }
  }

  return count;
}

function calculateMeasuredConfidence(
  stage: Stage,
  zoneName: AirportZoneName | null,
  observedTempC: number,
  recentMeasurements: readonly (TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  })[],
  polygons: AirportPolygons,
): number {
  if (stage === "in-flight") {
    return clampConfidence(0.95);
  }

  let confidence = zoneName === null ? 0.62 : 0.82;

  if (stage === "in-warehouse" || stage === "arrived-destination") {
    const matchesCoolRoom =
      zoneName === "cool-room" ||
      Math.abs(observedTempC - DEFAULT_COOL_ROOM_C) <= COOL_ROOM_DELTA_C;
    confidence += matchesCoolRoom ? 0.08 : 0.04;
  }

  if (stage === "in-tarmac" || stage === "arrived-tarmac") {
    confidence += observedTempC >= 30 ? 0.06 : 0.02;
  }

  const dwellCount = trailingDwellCount(recentMeasurements, polygons, zoneName);
  confidence += Math.min(dwellCount, 3) * 0.03;

  return clampConfidence(confidence);
}

function classifyMeasuredMeasurement(
  measurement: TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  },
  recentMeasurements: readonly (TrackerMeasurement & {
    recordedGeolocation: { latitude: number; longitude: number };
  })[],
  polygons: AirportPolygons,
  hasCompletedFlight: boolean,
): MeasurementClassification {
  const latitude = measurement.recordedGeolocation.latitude;
  const longitude = measurement.recordedGeolocation.longitude;
  const observedTempC = measurement.measurementValue.value;
  const altitudeM = getAltitudeM(measurement);
  const zoneName = findZoneForPoint(latitude, longitude, polygons);

  if (isFarFromDxb(latitude, longitude, polygons) && altitudeM > 0) {
    return {
      stage: "in-flight",
      internalSubState: null,
      confidence: 0.95,
      source: "measured",
      zoneName: null,
      timestamp: measurement.measurementTimestamp,
    };
  }

  if (zoneName !== null && warehouseZones.has(zoneName)) {
    const stage = hasCompletedFlight ? "arrived-destination" : "in-warehouse";
    return {
      stage,
      internalSubState: deriveWarehouseSubState(zoneName, observedTempC),
      confidence: calculateMeasuredConfidence(
        stage,
        zoneName,
        observedTempC,
        recentMeasurements,
        polygons,
      ),
      source: "measured",
      zoneName,
      timestamp: measurement.measurementTimestamp,
    };
  }

  if (zoneName !== null && tarmacZones.has(zoneName)) {
    const stage = hasCompletedFlight ? "arrived-tarmac" : "in-tarmac";
    return {
      stage,
      internalSubState: deriveTarmacSubState(zoneName),
      confidence: calculateMeasuredConfidence(
        stage,
        zoneName,
        observedTempC,
        recentMeasurements,
        polygons,
      ),
      source: "measured",
      zoneName,
      timestamp: measurement.measurementTimestamp,
    };
  }

  const fallbackStage = hasCompletedFlight ? "arrived-tarmac" : "in-tarmac";
  return {
    stage: fallbackStage,
    internalSubState: "staging",
    confidence: calculateMeasuredConfidence(
      fallbackStage,
      zoneName,
      observedTempC,
      recentMeasurements,
      polygons,
    ),
    source: "measured",
    zoneName,
    timestamp: measurement.measurementTimestamp,
  };
}

function locationStringToZoneName(location: string | null): AirportZoneName | null {
  if (location === null) {
    return null;
  }

  if (location.includes("cool-room")) {
    return "cool-room";
  }
  if (location.includes("build-up-area")) {
    return "build-up-area";
  }
  if (location.includes("apron-staging-1")) {
    return "apron-staging-1";
  }
  if (location.includes("apron-staging-2")) {
    return "apron-staging-2";
  }
  if (location.includes("tarmac-shadow-jetbridge")) {
    return "tarmac-shadow-jetbridge";
  }
  if (location.includes("tarmac-shadow-tail")) {
    return "tarmac-shadow-tail";
  }
  if (location.includes("gate-A12")) {
    return "gate-A12";
  }
  if (location.includes("runway-25R")) {
    return "runway-25R";
  }
  return null;
}

function stageFromZone(
  zoneName: AirportZoneName | null,
  hasCompletedFlight: boolean,
): Stage {
  if (zoneName !== null && warehouseZones.has(zoneName)) {
    return hasCompletedFlight ? "arrived-destination" : "in-warehouse";
  }
  if (zoneName !== null && tarmacZones.has(zoneName)) {
    return hasCompletedFlight ? "arrived-tarmac" : "in-tarmac";
  }
  return hasCompletedFlight ? "arrived-destination" : "in-warehouse";
}

function getUldIri(uldId: string) {
  return toIRI(uldId.startsWith("urn:") ? uldId : `urn:cargo:uld:${uldId}`);
}

function getLocationIri(stage: Stage, zoneName: AirportZoneName | null) {
  if (zoneName !== null) {
    return toIRI(`urn:cargo:zone:DXB-${zoneName}`);
  }

  if (stage === "in-flight") {
    return toIRI("urn:cargo:zone:airspace");
  }

  return toIRI("urn:cargo:zone:DXB-unknown");
}

function emitTransitionEvent(
  uldId: string,
  stage: Stage,
  timestamp: string,
  zoneName: AirportZoneName | null,
): void {
  const event: LogisticsEvent = {
    "@id": toIRI(
      `urn:cargo:event:${uldId}:${stageEventCode[stage]}:${encodeURIComponent(timestamp)}`,
    ),
    "@type": "LogisticsEvent",
    eventCode: stageEventCode[stage],
    eventName: stageEventName[stage],
    eventDate: timestamp,
    eventFor: getUldIri(uldId),
    eventLocation: getLocationIri(stage, zoneName),
    eventTimeType: "actual",
  };

  const bucket = emittedEvents.get(uldId);
  if (bucket) {
    bucket.push(event);
    return;
  }
  emittedEvents.set(uldId, [event]);
}

function classifyPassiveState(
  uldId: string,
  memory: UldClassifierMemory,
): ClassificationResult {
  const inventoryRecord = inventoryByUld.get(uldId);
  const location =
    typeof inventoryRecord?.lastKnownLocation === "string"
      ? inventoryRecord.lastKnownLocation
      : null;
  const lastKnownInternalC =
    typeof inventoryRecord?.lastKnownInternalC === "number" &&
    Number.isFinite(inventoryRecord.lastKnownInternalC)
      ? inventoryRecord.lastKnownInternalC
      : null;
  const zoneName = locationStringToZoneName(location);
  const stage = memory.forcedStage ?? stageFromZone(zoneName, memory.hasCompletedFlight);

  if (stage === "in-flight") {
    memory.hasCompletedFlight = true;
  }
  if (stage === "arrived-tarmac" || stage === "arrived-destination") {
    memory.hasCompletedFlight = true;
  }

  let internalSubState: InternalSubState = null;
  if (stage === "in-warehouse" || stage === "arrived-destination") {
    internalSubState = deriveWarehouseSubState(
      zoneName,
      lastKnownInternalC ?? DEFAULT_COOL_ROOM_C,
    );
  }
  if (stage === "in-tarmac" || stage === "arrived-tarmac") {
    internalSubState = deriveTarmacSubState(zoneName);
  }

  return {
    stage,
    internalSubState,
    confidence: clampConfidence(
      memory.forcedStage !== null
        ? 0.6
        : lastKnownInternalC === null
          ? 0.45
          : 0.55,
    ),
    source: "inferred",
  };
}

function getLastKnownLocation(uldId: string): string | null {
  const location = inventoryByUld.get(uldId)?.lastKnownLocation;
  return typeof location === "string" ? location : null;
}

function maybeEmitStageChange(
  uldId: string,
  previousStage: Stage | null,
  next: MeasurementClassification,
): void {
  if (previousStage !== null && previousStage !== next.stage) {
    emitTransitionEvent(uldId, next.stage, next.timestamp, next.zoneName);
  }
}

export function forceState(uldId: string, stage: Stage): void {
  const memory = getOrCreateMemory(uldId);
  memory.forcedStage = stage;
}

export function applyScenarioEvent(event: ScenarioStateForceEvent): void {
  if (event.type === "uld_state_force") {
    forceState(event.uldId, event.state);
  }
}

export function resetStateClassifier(): void {
  stageMemory.clear();
  emittedEvents.clear();
}

export function getEmittedStateEvents(uldId?: string): LogisticsEvent[] {
  if (uldId) {
    return [...(emittedEvents.get(uldId) ?? [])];
  }
  return [...emittedEvents.values()].flatMap((events) => events);
}

export function classifyState(
  uldId: string,
  recentMeasurements: Measurement[],
  polygons: AirportPolygons,
): ClassificationResult {
  const memory = getOrCreateMemory(uldId);
  const geolocatedMeasurements = sortMeasurements(
    recentMeasurements.filter(isGeolocatedMeasurement),
  );

  if (geolocatedMeasurements.length === 0) {
    const passiveResult = classifyPassiveState(uldId, memory);
    if (memory.lastStage !== null && memory.lastStage !== passiveResult.stage) {
      emitTransitionEvent(
        uldId,
        passiveResult.stage,
        new Date().toISOString(),
        locationStringToZoneName(getLastKnownLocation(uldId)),
      );
    }
    memory.lastStage = passiveResult.stage;
    return passiveResult;
  }

  const newMeasurements = getNewMeasurements(
    geolocatedMeasurements,
    memory.lastProcessedMeasurementTimestamp,
  );

  if (newMeasurements.length > 0) {
    let cursorStage = memory.lastStage;
    let hasCompletedFlight = memory.hasCompletedFlight;
    let startIndex = 0;

    if (cursorStage === null) {
      const baseline = classifyMeasuredMeasurement(
        newMeasurements[0],
        geolocatedMeasurements,
        polygons,
        hasCompletedFlight,
      );
      cursorStage = baseline.stage;
      if (
        baseline.stage === "in-flight" ||
        baseline.stage === "arrived-tarmac" ||
        baseline.stage === "arrived-destination"
      ) {
        hasCompletedFlight = true;
      }
      startIndex = 1;
    }

    for (let index = startIndex; index < newMeasurements.length; index += 1) {
      const next = classifyMeasuredMeasurement(
        newMeasurements[index],
        geolocatedMeasurements.slice(0, geolocatedMeasurements.length),
        polygons,
        hasCompletedFlight,
      );
      maybeEmitStageChange(uldId, cursorStage, next);
      cursorStage = next.stage;
      if (
        next.stage === "in-flight" ||
        next.stage === "arrived-tarmac" ||
        next.stage === "arrived-destination"
      ) {
        hasCompletedFlight = true;
      }
    }

    memory.hasCompletedFlight = hasCompletedFlight;
    memory.lastProcessedMeasurementTimestamp =
      newMeasurements[newMeasurements.length - 1].measurementTimestamp;
  }

  const latest = geolocatedMeasurements[geolocatedMeasurements.length - 1];
  const result = classifyMeasuredMeasurement(
    latest,
    geolocatedMeasurements,
    polygons,
    memory.hasCompletedFlight,
  );

  if (
    result.stage === "in-flight" ||
    result.stage === "arrived-tarmac" ||
    result.stage === "arrived-destination"
  ) {
    memory.hasCompletedFlight = true;
  }

  memory.lastStage = result.stage;
  memory.forcedStage = null;

  return {
    stage: result.stage,
    internalSubState: result.internalSubState,
    confidence: result.confidence,
    source: result.source,
  };
}
