import { describe, expect, it, vi } from "vitest";

vi.mock("../../physics/pcm-model", () => ({
  integrateBudget: vi.fn(() => ({
    budgetSec: 3 * 3600,
    breachAt: new Date("2026-04-25T14:20:00Z"),
  })),
}));

import { budgetPreflight } from "../budget-preflight";
import { toIRI, type Piece, type ULD } from "../../ontology/one-record";
import type { AmbientCurve } from "../budget-preflight";

type BuildUpPiece = Piece & {
  shc?: string;
  temperatureInstructions?: {
    "@id": string;
    "@type": "TemperatureInstructions";
    minTemperature: { value: number; unit: "C" };
    maxTemperature: { value: number; unit: "C" };
  };
};

type BudgetUld = ULD & {
  uldProductCode?: string;
  lastKnownInternalC?: number;
};

function makePiece(): BuildUpPiece {
  return {
    "@id": toIRI("urn:cargo:piece:budget-1"),
    "@type": "Piece",
    grossWeight: { value: 1, unit: "kg" },
    ofShipment: toIRI("urn:cargo:shipment:test"),
    shc: "COL",
    temperatureInstructions: {
      "@id": "urn:cargo:temp:budget-1",
      "@type": "TemperatureInstructions",
      minTemperature: { value: 2, unit: "C" },
      maxTemperature: { value: 8, unit: "C" },
    },
  };
}

function makeUld(): BudgetUld {
  return {
    "@id": toIRI("urn:cargo:uld:AKE-12345EK"),
    "@type": "ULD",
    uldSerialNumber: "AKE-12345EK",
    uldTypeCode: "AKE",
    serviceabilityCode: "SER",
    damageFlag: false,
    ownerCode: "EK",
    uldProductCode: "ENVIROTAINER_RAP_COL",
    lastKnownInternalC: 4.2,
  };
}

describe("budgetPreflight.forecast", () => {
  it("converts budget seconds to hours and derives the warning color", () => {
    const projectedAmbient: AmbientCurve = [
      {
        "@id": toIRI("urn:cargo:measurement:ambient-1"),
        "@type": "Measurement",
        measurementValue: { value: 35, unit: "C" },
        measurementTimestamp: "2026-04-25T12:00:00Z",
        bySensor: toIRI("urn:cargo:sensor:ambient"),
      },
      {
        "@id": toIRI("urn:cargo:measurement:ambient-2"),
        "@type": "Measurement",
        measurementValue: { value: 41, unit: "C" },
        measurementTimestamp: "2026-04-25T14:00:00Z",
        bySensor: toIRI("urn:cargo:sensor:ambient"),
      },
    ];

    const result = budgetPreflight.forecast(
      makeUld(),
      [makePiece()],
      projectedAmbient,
    );

    expect(result).toEqual({
      budgetH: 3,
      breachAt: "2026-04-25T14:20:00.000Z",
      warning: "yellow",
    });
  });
});
