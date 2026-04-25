import type {
  Measurement,
  TemperatureInstructions,
} from "@/lib/ontology/one-record";
import { toIRI } from "@/lib/ontology/one-record";
import { describe, expect, it } from "vitest";
import { integrateBudget, pcmAbsorption } from "../pcm-model";
import { getUldSpec } from "../uld-specs-loader";

const START_TIMESTAMP = Date.parse("2026-04-25T00:00:00.000Z");

function makeAmbientCurve(
  tempC: number,
  durationHours: number,
  dt: number,
): Measurement[] {
  const durationSec = durationHours * 3600;

  return Array.from(
    { length: Math.floor(durationSec / dt) + 1 },
    (_, index): Measurement => {
      const elapsedSec = index * dt;

      return {
        "@id": toIRI(`urn:measurement:ambient:${tempC}:${elapsedSec}`),
        "@type": "Measurement",
        measurementValue: { value: tempC, unit: "C" },
        measurementTimestamp: new Date(
          START_TIMESTAMP + elapsedSec * 1000,
        ).toISOString(),
        bySensor: toIRI("urn:sensor:ambient"),
      };
    },
  );
}

function makeSegmentedAmbientCurve(
  durationHours: number,
  dt: number,
  tempAtHour: (hour: number) => number,
): Measurement[] {
  const durationSec = durationHours * 3600;

  return Array.from(
    { length: Math.floor(durationSec / dt) + 1 },
    (_, index): Measurement => {
      const elapsedSec = index * dt;
      const hour = elapsedSec / 3600;

      return {
        "@id": toIRI(`urn:measurement:ambient:segmented:${elapsedSec}`),
        "@type": "Measurement",
        measurementValue: { value: tempAtHour(hour), unit: "C" },
        measurementTimestamp: new Date(
          START_TIMESTAMP + elapsedSec * 1000,
        ).toISOString(),
        bySensor: toIRI("urn:sensor:ambient"),
      };
    },
  );
}

function makeCrtThreshold(): TemperatureInstructions {
  return {
    "@id": toIRI("urn:temperature-instructions:crt"),
    "@type": "TemperatureInstructions",
    minTemperature: { value: 2, unit: "C" },
    maxTemperature: { value: 8, unit: "C" },
  };
}

describe("integrateBudget", () => {
  it("returns latent absorption only while internal temperature is inside the melt band", () => {
    const spec = getUldSpec("ENVIROTAINER_RAP_COL");

    expect(pcmAbsorption(spec.pcmMeltStart - 0.1, spec)).toBe(0);
    expect(pcmAbsorption(spec.pcmMeltStart, spec)).toBeGreaterThan(0);
    expect(pcmAbsorption(spec.pcmMeltEnd + 0.1, spec)).toBe(0);
  });

  it("keeps a cold COL ULD safe for at least 24 hours in a cool warehouse", () => {
    const spec = getUldSpec("ENVIROTAINER_RAP_COL");
    const result = integrateBudget(
      spec,
      4,
      makeAmbientCurve(20, 200, 60),
      60,
      makeCrtThreshold(),
    );

    expect(result.budgetSec).toBeGreaterThanOrEqual(86_400);
  });

  it("breaches in extreme heat within the rated autonomy tolerance band", () => {
    const spec = getUldSpec("ENVIROTAINER_RAP_COL");
    const ratedAutonomySec = spec.autonomyHours * 3600;
    const result = integrateBudget(
      spec,
      4,
      makeAmbientCurve(45, 200, 60),
      60,
      makeCrtThreshold(),
    );

    expect(result.budgetSec).toBeGreaterThanOrEqual(ratedAutonomySec * 0.9);
    expect(result.budgetSec).toBeLessThanOrEqual(ratedAutonomySec * 1.1);
  });

  it("shows a near-flat melt plateau and steeper heating outside the PCM band", () => {
    const spec = getUldSpec("ENVIROTAINER_RAP_COL");
    const result = integrateBudget(
      spec,
      2,
      makeAmbientCurve(30, 120, 60),
      60,
      makeCrtThreshold(),
    );

    const deltas = result.tempTrace.slice(1).map((point, index) => {
      const previous = result.tempTrace[index];
      return {
        prevT: previous.T,
        currentT: point.T,
        dT: point.T - previous.T,
      };
    });
    const withinMeltBand = deltas.filter(
      ({ prevT, currentT }) =>
        prevT >= spec.pcmMeltStart &&
        prevT <= spec.pcmMeltEnd &&
        currentT >= spec.pcmMeltStart &&
        currentT <= spec.pcmMeltEnd,
    );
    const outsideMeltBand = deltas.filter(
      ({ prevT, currentT }) =>
        prevT < spec.pcmMeltStart || currentT > spec.pcmMeltEnd,
    );

    expect(withinMeltBand.length).toBeGreaterThan(0);
    expect(Math.max(...withinMeltBand.map(({ dT }) => dT))).toBeLessThanOrEqual(
      0.05,
    );
    expect(
      outsideMeltBand.some(({ dT }) => dT > 0.05),
    ).toBe(true);
  });

  it("extends budget when a cooling window interrupts the hot ambient period", () => {
    const spec = getUldSpec("ENVIROTAINER_RAP_COL");
    const hotBaseline = integrateBudget(
      spec,
      4,
      makeAmbientCurve(45, 200, 60),
      60,
      makeCrtThreshold(),
    );
    const coolWindow = integrateBudget(
      spec,
      4,
      makeSegmentedAmbientCurve(200, 60, (hour) => {
        if (hour < 48) {
          return 45;
        }

        if (hour < 96) {
          return 15;
        }

        return 45;
      }),
      60,
      makeCrtThreshold(),
    );

    expect(coolWindow.budgetSec).toBeGreaterThan(hotBaseline.budgetSec);
  });
});
