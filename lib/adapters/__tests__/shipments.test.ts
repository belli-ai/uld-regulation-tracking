import { describe, expect, it } from "vitest";
import {
  adaptAllMockShipments,
  adaptMockShipmentsForFlight,
  adaptOnePiece,
} from "@/lib/adapters/shipments";

const SAMPLE = {
  EK0083: [
    {
      "@id": "urn:cargo:waybill:176-12345678",
      "@type": "Waybill",
      waybillPrefix: "176",
      waybillNumber: "12345678",
      departureLocation: "urn:cargo:loc:DXB",
      arrivalLocation: "urn:cargo:loc:FRA",
      shc: "COL",
      declaredValueForCarriage: { value: 850000, currency: "USD" },
      pieces: [
        {
          "@id": "urn:cargo:piece:176-12345678-1",
          "@type": "Piece",
          grossWeight: { value: 36, unit: "kg" },
          dimensions: { length: 60, width: 40, height: 35, unit: "cm" },
          ofShipment: "urn:cargo:waybill:176-12345678",
          temperatureInstructions: {
            "@id": "urn:cargo:tempinstr:176-12345678-1",
            "@type": "TemperatureInstructions",
            minTemperature: { value: 2, unit: "C" },
            maxTemperature: { value: 8, unit: "C" },
          },
          dgDeclaration: "urn:cargo:dgdec:DG-LITHIUM-001",
        },
      ],
    },
  ],
};

describe("adaptMockShipmentsForFlight", () => {
  it("returns canonical Waybill[] for a known flight", () => {
    const result = adaptMockShipmentsForFlight(SAMPLE, "EK0083");
    expect(result).toHaveLength(1);
    const waybill = result[0];
    expect(waybill["@type"]).toBe("Waybill");
    expect(waybill.shc).toBe("COL");
    expect(waybill.declaredValueForCarriage).toEqual({
      value: 850000,
      currency: "USD",
    });
    expect(waybill.pieces).toHaveLength(1);
    expect(waybill.pieces[0].grossWeight).toEqual({ value: 36, unit: "kg" });
  });

  it("returns [] for an unknown flight", () => {
    expect(adaptMockShipmentsForFlight(SAMPLE, "NOPE")).toEqual([]);
  });
});

describe("adaptOnePiece", () => {
  it("strips non-canonical fields like temperatureInstructions and dgDeclaration", () => {
    const piece = adaptOnePiece(SAMPLE.EK0083[0].pieces[0]);
    const keys = Object.keys(piece);
    expect(keys).not.toContain("temperatureInstructions");
    expect(keys).not.toContain("dgDeclaration");
    expect(piece.dimensions).toEqual({
      length: 60,
      width: 40,
      height: 35,
      unit: "cm",
    });
  });
});

describe("adaptAllMockShipments", () => {
  it("returns waybills keyed by flight number", () => {
    const all = adaptAllMockShipments(SAMPLE);
    expect(Object.keys(all)).toEqual(["EK0083"]);
    expect(all.EK0083).toHaveLength(1);
  });
});
