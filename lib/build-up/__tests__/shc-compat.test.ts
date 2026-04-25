import { describe, expect, it } from "vitest";
import { shcCompat } from "../shc-compat";
import { toIRI, type Piece } from "../../ontology/one-record";

type BuildUpPiece = Piece & {
  shc?: string;
  temperatureInstructions?: {
    "@id": string;
    "@type": "TemperatureInstructions";
    minTemperature: { value: number; unit: "C" };
    maxTemperature: { value: number; unit: "C" };
  };
};

function makePiece(
  id: string,
  shc: string,
  minTemperature: number,
  maxTemperature: number,
): BuildUpPiece {
  return {
    "@id": toIRI(id),
    "@type": "Piece",
    grossWeight: { value: 1, unit: "kg" },
    ofShipment: toIRI("urn:cargo:shipment:test"),
    shc,
    temperatureInstructions: {
      "@id": `${id}:temp`,
      "@type": "TemperatureInstructions",
      minTemperature: { value: minTemperature, unit: "C" },
      maxTemperature: { value: maxTemperature, unit: "C" },
    },
  };
}

describe("shcCompat.compatible", () => {
  it("allows COL and PER pieces that share the same 2-8C range", () => {
    const colPiece = makePiece("urn:cargo:piece:col-1", "COL", 2, 8);
    const perPiece = makePiece("urn:cargo:piece:per-1", "PER", 2, 8);

    const result = shcCompat.compatible([colPiece, perPiece]);

    expect(result.ok).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it("rejects COL and CRT pieces with incompatible temperature ranges", () => {
    const colPiece = makePiece("urn:cargo:piece:col-2", "COL", 2, 8);
    const crtPiece = makePiece("urn:cargo:piece:crt-1", "CRT", 15, 25);

    const result = shcCompat.compatible([colPiece, crtPiece]);

    expect(result.ok).toBe(false);
    expect(result.conflicts).not.toHaveLength(0);
    expect(result.conflicts[0]?.reason).toContain("Temperature range mismatch");
    expect(result.conflicts[0]?.shcCodes).toEqual(["COL", "CRT"]);
  });
});
