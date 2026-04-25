import { afterEach, describe, expect, it, vi } from "vitest";
import scenariosData from "@/public/data/scenarios.json";
import { scenariosFileSchema } from "@/lib/simulator/scenario-schema";
import {
  startTrackerFeed,
  type ScenarioParams,
} from "@/lib/simulator/tracker-feed";

const parsedScenarios = scenariosFileSchema.parse(scenariosData);
const mainScenario = parsedScenarios.scenarios.find(
  (scenario: ScenarioParams) => scenario.id === "dxb-warehouse-demo",
);

if (mainScenario === undefined) {
  throw new Error("missing dxb-warehouse-demo scenario fixture");
}

function createLogicalClock(multiplier: number): () => number {
  const realStart = Date.now();
  return () => (Date.now() - realStart) * 600 * multiplier;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function interpolateExpectedPosition(fraction: number): {
  latitude: number;
  longitude: number;
} {
  const departure = { latitude: 25.2532, longitude: 55.3657 };
  const arrival = { latitude: 50.0379, longitude: 8.5622 };
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

  const dot = Math.min(
    Math.max(
      startVector.x * endVector.x +
        startVector.y * endVector.y +
        startVector.z * endVector.z,
      -1,
    ),
    1,
  );
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const startScale = Math.sin((1 - fraction) * omega) / sinOmega;
  const endScale = Math.sin(fraction * omega) / sinOmega;
  const point = {
    x: startVector.x * startScale + endVector.x * endScale,
    y: startVector.y * startScale + endVector.y * endScale,
    z: startVector.z * startScale + endVector.z * endScale,
  };

  return {
    latitude: toDegrees(
      Math.atan2(point.z, Math.sqrt(point.x ** 2 + point.y ** 2)),
    ),
    longitude: toDegrees(Math.atan2(point.y, point.x)),
  };
}

async function collectEmissions(
  scenario: ScenarioParams,
  emissionCount: number,
): Promise<unknown[]> {
  vi.useFakeTimers();
  const logicalClock = createLogicalClock(1);
  const feed = startTrackerFeed("AKE-12345EK", scenario, logicalClock);

  if (feed === null) {
    throw new Error("expected active tracker feed");
  }

  const emissions: unknown[] = [];
  const subscription = feed.subscribe((measurementBatch) => {
    emissions.push(measurementBatch);
  });

  await vi.advanceTimersByTimeAsync(emissionCount * 1000 + 50);

  subscription.unsubscribe();
  feed.stop();

  return emissions.slice(0, emissionCount);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startTrackerFeed", () => {
  it("emits deterministic measurement sequences for the same scenario", async () => {
    const firstRun = await collectEmissions(mainScenario, 3);
    const secondRun = await collectEmissions(mainScenario, 3);

    expect(firstRun).toEqual(secondRun);
  });

  it("scales emission timing with demo speed", async () => {
    vi.useFakeTimers();

    const oneXTimes: number[] = [];
    const oneXStart = Date.now();
    const oneXFeed = startTrackerFeed(
      "AKE-12345EK",
      mainScenario,
      createLogicalClock(1),
    );
    if (oneXFeed === null) {
      throw new Error("expected 1x tracker feed");
    }
    const oneXSubscription = oneXFeed.subscribe(() => {
      oneXTimes.push(Date.now() - oneXStart);
    });

    await vi.advanceTimersByTimeAsync(1100);

    oneXSubscription.unsubscribe();
    oneXFeed.stop();

    vi.useRealTimers();
    vi.useFakeTimers();

    const twoXTimes: number[] = [];
    const twoXStart = Date.now();
    const twoXFeed = startTrackerFeed(
      "AKE-12345EK",
      mainScenario,
      createLogicalClock(2),
    );
    if (twoXFeed === null) {
      throw new Error("expected 2x tracker feed");
    }
    const twoXSubscription = twoXFeed.subscribe(() => {
      twoXTimes.push(Date.now() - twoXStart);
    });

    await vi.advanceTimersByTimeAsync(600);

    twoXSubscription.unsubscribe();
    twoXFeed.stop();

    expect(oneXTimes[0]).toBe(1000);
    expect(twoXTimes[0]).toBe(500);
  });

  it("emits GPS coordinates along the expected great-circle path", async () => {
    vi.useFakeTimers();

    const logicalClock = createLogicalClock(1);
    const feed = startTrackerFeed("AKE-12345EK", mainScenario, logicalClock);

    if (feed === null) {
      throw new Error("expected GPS tracker feed");
    }

    const gpsCoordinates: Array<{ latitude: number; longitude: number }> = [];
    const subscription = feed.subscribe((measurementBatch) => {
      const gpsMeasurement = measurementBatch.find(
        (measurement) => measurement.recordedGeolocation !== undefined,
      );
      if (gpsMeasurement?.recordedGeolocation !== undefined) {
        gpsCoordinates.push(gpsMeasurement.recordedGeolocation);
      }
    });

    await vi.advanceTimersByTimeAsync(3050);

    subscription.unsubscribe();
    feed.stop();

    expect(gpsCoordinates).toHaveLength(3);

    const scheduledFlightDurationMinutes = 405;
    const expectedFractions = [10, 20, 30].map(
      (minutes) => minutes / scheduledFlightDurationMinutes,
    );

    gpsCoordinates.forEach((coordinate, index) => {
      const expected = interpolateExpectedPosition(expectedFractions[index] ?? 0);
      expect(coordinate.latitude).toBeCloseTo(expected.latitude, 3);
      expect(coordinate.longitude).toBeCloseTo(expected.longitude, 3);
    });
  });
});
