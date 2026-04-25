"use client";

import airportsData from "@/public/data/airports.json";
import flightsData from "@/public/data/flights.json";
import iotDevicesData from "@/public/data/iot-devices.json";
import uldInventoryData from "@/public/data/uld-inventory.json";
import { toIRI, type Measurement, type Sensor } from "@/lib/ontology/one-record";
import type { Scenario } from "@/lib/simulator/scenario-schema";

const LOGICAL_CADENCE_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 20;
const EARTH_RADIUS_KM = 6371;

type RawAirport = {
  iata: string;
  latitude: number;
  longitude: number;
};

type RawFlight = {
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  movementTimes?: Array<{
    type?: string;
    timestamp?: string;
  }>;
};

type RawSensor = {
  "@id": string;
  "@type": "Sensor";
  sensorType: Sensor["sensorType"];
  serialNumber: string;
  partOfIotDevice: string;
};

type RawIotDevice = {
  "@id": string;
  "@type": "IotDevice";
  serialNumber: string;
  attachedTo: string;
  sensors: RawSensor[];
};

type RawUld = {
  "@id": string;
  uldSerialNumber: string;
  iotDeviceId?: string;
  lastKnownInternalC?: number;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type TrackedSensorType = Extract<
  Sensor["sensorType"],
  "TEMPERATURE" | "HUMIDITY" | "GPS" | "SHOCK"
>;

type TrackerListener = (measurements: Measurement[]) => void;

type TrackerSubscription = {
  unsubscribe: () => void;
};

export type ScenarioParams = Scenario;

export type TrackerFeed = {
  subscribe: (listener: TrackerListener) => TrackerSubscription;
  stop: () => void;
};

const airports = airportsData as Record<string, RawAirport>;
const flights = flightsData as RawFlight[];
const iotDevices = iotDevicesData as RawIotDevice[];
const uldInventory = uldInventoryData as RawUld[];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let output = Math.imul(state ^ (state >>> 15), state | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normaliseLongitude(value: number): number {
  if (value > 180) {
    return value - 360;
  }
  if (value < -180) {
    return value + 360;
  }
  return value;
}

function getLocationCode(locationIri: string): string {
  const parts = locationIri.split(":");
  return parts[parts.length - 1] ?? locationIri;
}

function getMovementTimestamp(
  flight: RawFlight,
  type: "STD" | "STA",
): number | null {
  const match = flight.movementTimes?.find((entry) => entry.type === type);
  if (typeof match?.timestamp !== "string") {
    return null;
  }
  const timestamp = Date.parse(match.timestamp);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getFlightDurationMs(flight: RawFlight): number {
  const departureMs = getMovementTimestamp(flight, "STD");
  const arrivalMs = getMovementTimestamp(flight, "STA");
  if (departureMs === null || arrivalMs === null || arrivalMs <= departureMs) {
    return 6 * 60 * 60 * 1000;
  }
  return arrivalMs - departureMs;
}

function getScenarioFlightNumber(
  uldId: string,
  scenarioParams: ScenarioParams,
): string | null {
  const events = scenarioParams.events ?? [];
  for (const event of events) {
    if (event.uldId !== uldId) {
      continue;
    }
    if (typeof event.flightNo === "string") {
      return event.flightNo;
    }
    if (typeof event.flight === "string") {
      return event.flight;
    }
  }

  const scenarioFlights = scenarioParams.initial_state?.flights ?? [];
  if (scenarioFlights.length === 0) {
    return null;
  }

  const scenarioUlds = scenarioParams.initial_state?.ulds ?? [];
  const uldIndex = scenarioUlds.indexOf(uldId);
  if (uldIndex >= 0) {
    return scenarioFlights[uldIndex % scenarioFlights.length] ?? null;
  }

  return scenarioFlights[0] ?? null;
}

function getFlightForUld(
  uldId: string,
  scenarioParams: ScenarioParams,
): RawFlight | null {
  const flightNumber = getScenarioFlightNumber(uldId, scenarioParams);
  if (flightNumber === null) {
    return null;
  }
  return flights.find((flight) => flight.flightNumber === flightNumber) ?? null;
}

function getRouteCoordinates(flight: RawFlight | null): {
  departure: Coordinates;
  arrival: Coordinates;
  departureTimeMs: number;
  durationMs: number;
} {
  if (flight === null) {
    return {
      departure: { latitude: 25.2532, longitude: 55.3657 },
      arrival: { latitude: 50.0379, longitude: 8.5622 },
      departureTimeMs: Date.parse("2026-04-25T14:20:00+04:00"),
      durationMs: 6 * 60 * 60 * 1000,
    };
  }

  const departureCode = getLocationCode(flight.departureLocation);
  const arrivalCode = getLocationCode(flight.arrivalLocation);
  const departureAirport = airports[departureCode];
  const arrivalAirport = airports[arrivalCode];

  return {
    departure: departureAirport
      ? {
          latitude: departureAirport.latitude,
          longitude: departureAirport.longitude,
        }
      : { latitude: 25.2532, longitude: 55.3657 },
    arrival: arrivalAirport
      ? {
          latitude: arrivalAirport.latitude,
          longitude: arrivalAirport.longitude,
        }
      : { latitude: 50.0379, longitude: 8.5622 },
    departureTimeMs:
      getMovementTimestamp(flight, "STD") ??
      Date.parse("2026-04-25T14:20:00+04:00"),
    durationMs: getFlightDurationMs(flight),
  };
}

function interpolateGreatCircle(
  departure: Coordinates,
  arrival: Coordinates,
  fraction: number,
): Coordinates {
  const clampedFraction = clamp(fraction, 0, 1);
  const lat1 = toRadians(departure.latitude);
  const lon1 = toRadians(departure.longitude);
  const lat2 = toRadians(arrival.latitude);
  const lon2 = toRadians(arrival.longitude);

  const startVector = {
    x: Math.cos(lat1) * Math.cos(lon1),
    y: Math.cos(lat1) * Math.sin(lon1),
    z: Math.sin(lat1),
  };
  const endVector = {
    x: Math.cos(lat2) * Math.cos(lon2),
    y: Math.cos(lat2) * Math.sin(lon2),
    z: Math.sin(lat2),
  };

  const dot = clamp(
    startVector.x * endVector.x +
      startVector.y * endVector.y +
      startVector.z * endVector.z,
    -1,
    1,
  );
  const omega = Math.acos(dot);

  if (omega === 0) {
    return departure;
  }

  const sinOmega = Math.sin(omega);
  const startScale = Math.sin((1 - clampedFraction) * omega) / sinOmega;
  const endScale = Math.sin(clampedFraction * omega) / sinOmega;
  const point = {
    x: startVector.x * startScale + endVector.x * endScale,
    y: startVector.y * startScale + endVector.y * endScale,
    z: startVector.z * startScale + endVector.z * endScale,
  };

  const latitude = toDegrees(
    Math.atan2(point.z, Math.sqrt(point.x ** 2 + point.y ** 2)),
  );
  const longitude = toDegrees(Math.atan2(point.y, point.x));

  return {
    latitude: roundTo(latitude, 6),
    longitude: roundTo(normaliseLongitude(longitude), 6),
  };
}

function getGreatCircleDistanceKm(
  departure: Coordinates,
  arrival: Coordinates,
): number {
  const lat1 = toRadians(departure.latitude);
  const lon1 = toRadians(departure.longitude);
  const lat2 = toRadians(arrival.latitude);
  const lon2 = toRadians(arrival.longitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * arc;
}

function getRawUld(uldId: string): RawUld | null {
  return (
    uldInventory.find(
      (uld) => uld.uldSerialNumber === uldId || uld["@id"] === uldId,
    ) ?? null
  );
}

function getRawDevice(rawUld: RawUld): RawIotDevice | null {
  if (typeof rawUld.iotDeviceId !== "string" || rawUld.iotDeviceId.length === 0) {
    return null;
  }
  return (
    iotDevices.find(
      (device) =>
        device.serialNumber === rawUld.iotDeviceId ||
        device.attachedTo === rawUld["@id"],
    ) ?? null
  );
}

function buildMeasurements(
  stepIndex: number,
  logicalElapsedMs: number,
  rawUld: RawUld,
  rawDevice: RawIotDevice,
  scenarioParams: ScenarioParams,
  route: ReturnType<typeof getRouteCoordinates>,
): Measurement[] {
  const seed = hashString(
    JSON.stringify({
      stepIndex,
      uldId: rawUld.uldSerialNumber,
      scenarioId: scenarioParams.id,
      tags: scenarioParams.tags,
    }),
  );
  const random = mulberry32(seed);
  const progress = clamp(logicalElapsedMs / route.durationMs, 0, 1);
  const position = interpolateGreatCircle(route.departure, route.arrival, progress);
  const ambientTemperature =
    scenarioParams.initial_state?.weather_override?.ambient_c ?? 30;
  const ambientHumidity =
    scenarioParams.initial_state?.weather_override?.humidity_pct ?? 55;
  const initialInternalTemperature =
    rawUld.lastKnownInternalC ?? clamp(ambientTemperature - 8, -25, 25);
  const internalDrift = (ambientTemperature - initialInternalTemperature) * progress;
  const shockBase = progress < 0.08 ? 0.8 : 0.12;
  const shockSpike = random() > 0.94 ? 0.9 + random() * 1.6 : 0;
  const measurementTimestamp = new Date(
    route.departureTimeMs + logicalElapsedMs,
  ).toISOString();
  const routeDistanceKm = getGreatCircleDistanceKm(route.departure, position);

  const sensorValues: Record<
    TrackedSensorType,
    Omit<Measurement, "@id" | "@type" | "bySensor">
  > = {
    TEMPERATURE: {
      measurementValue: {
        value: roundTo(
          initialInternalTemperature + internalDrift + (random() - 0.5) * 0.4,
          2,
        ),
        unit: "C",
      },
      measurementTimestamp,
    },
    HUMIDITY: {
      measurementValue: {
        value: roundTo(
          clamp(
            ambientHumidity +
              progress * 8 +
              (ambientTemperature - initialInternalTemperature) * 0.6 +
              (random() - 0.5) * 5,
            10,
            99,
          ),
          2,
        ),
        unit: "pct",
      },
      measurementTimestamp,
    },
    GPS: {
      measurementValue: {
        value: roundTo(routeDistanceKm, 3),
        unit: "km",
      },
      measurementTimestamp,
      recordedGeolocation: position,
    },
    SHOCK: {
      measurementValue: {
        value: roundTo(shockBase + random() * 0.25 + shockSpike, 3),
        unit: "g",
      },
      measurementTimestamp,
    },
  };

  return rawDevice.sensors
    .filter(
      (sensor): sensor is RawSensor & { sensorType: TrackedSensorType } =>
        sensor.sensorType === "TEMPERATURE" ||
        sensor.sensorType === "HUMIDITY" ||
        sensor.sensorType === "GPS" ||
        sensor.sensorType === "SHOCK",
    )
    .map((sensor) => ({
      "@id": toIRI(
        `urn:cargo:measurement:${rawDevice.serialNumber}:${sensor.serialNumber}:${stepIndex}`,
      ),
      "@type": "Measurement",
      ...sensorValues[sensor.sensorType],
      bySensor: toIRI(sensor["@id"]),
    }));
}

export function startTrackerFeed(
  uldId: string,
  scenarioParams: ScenarioParams,
  getLogicalTime: () => number,
): TrackerFeed | null {
  const rawUld = getRawUld(uldId);
  if (rawUld === null) {
    return null;
  }

  const rawDevice = getRawDevice(rawUld);
  if (rawDevice === null) {
    return null;
  }

  const route = getRouteCoordinates(getFlightForUld(uldId, scenarioParams));
  const logicalStartTime = getLogicalTime();
  const listeners = new Set<TrackerListener>();
  let disposed = false;
  let emittedStepCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const pump = (): void => {
    if (disposed) {
      return;
    }

    const logicalElapsedMs = Math.max(getLogicalTime() - logicalStartTime, 0);
    const targetStepCount = Math.floor(logicalElapsedMs / LOGICAL_CADENCE_MS);

    while (emittedStepCount < targetStepCount) {
      emittedStepCount += 1;
      const emissionElapsedMs = emittedStepCount * LOGICAL_CADENCE_MS;
      const measurements = buildMeasurements(
        emittedStepCount,
        emissionElapsedMs,
        rawUld,
        rawDevice,
        scenarioParams,
        route,
      );
      for (const listener of listeners) {
        listener(measurements);
      }
    }
  };

  const startTimer = (): void => {
    if (timer !== null || disposed) {
      return;
    }
    timer = setInterval(pump, POLL_INTERVAL_MS);
  };

  const stop = (): void => {
    disposed = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    listeners.clear();
  };

  return {
    subscribe(listener: TrackerListener): TrackerSubscription {
      if (disposed) {
        return { unsubscribe: () => undefined };
      }

      listeners.add(listener);
      startTimer();

      return {
        unsubscribe: () => {
          listeners.delete(listener);
          if (listeners.size === 0 && timer !== null) {
            clearInterval(timer);
            timer = null;
          }
        },
      };
    },
    stop,
  };
}
