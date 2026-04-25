import { describe, expect, it, vi } from "vitest";
import { NS } from "@/lib/adapters/one-connect/json-ld";
import {
  adaptOneConnectPiece,
  notificationsToWaybills,
} from "@/lib/adapters/one-connect/waybills";

function notification(type: string, iri: string): Record<string, unknown> {
  return {
    "@type": "api:Notification",
    "api:hasLogisticsObjectType": `${NS.cargo}${type}`,
    "api:hasLogisticsObject": { "@id": iri },
  };
}

function value(value: number, unit: string): Record<string, unknown> {
  return {
    "@type": "cargo:Value",
    "cargo:numericalValue": String(value),
    "cargo:unit": { "@id": unit },
  };
}

function piece(id = "urn:piece:1", ofShipment = "urn:shipment:1"): Record<string, unknown> {
  return {
    "@id": id,
    "@type": "cargo:Piece",
    "cargo:ofShipment": { "@id": ofShipment },
    "cargo:dimensions": {
      "@type": "cargo:Dimensions",
      "cargo:length": value(120, `${NS.unit}CMT`),
      "cargo:width": value(64, `${NS.unit}CMT`),
      "cargo:height": value(60, `${NS.unit}CMT`),
    },
    "cargo:totalGrossWeight": value(25, `${NS.unit}KGM`),
    "internal:temperatureProfile": "COL",
  };
}

function waybill(id = "urn:waybill:house"): Record<string, unknown> {
  return {
    "@id": id,
    "@type": "cargo:Waybill",
    "cargo:waybillNumber": "176-12345675",
    "cargo:waybillType": "HOUSE",
    "cargo:specialHandlingCodes": [{ "@id": `${NS.shc}PER` }],
    "cargo:departureLocation": { "@id": "urn:location:HKG" },
    "cargo:arrivalLocation": { "@id": "urn:location:DXB" },
    "cargo:masterWaybill": {
      "@id": "urn:waybill:master",
      "@type": "cargo:Waybill",
      "cargo:waybillNumber": "176-87654321",
      "cargo:shipment": {
        "@id": "urn:shipment:1",
        "@type": "cargo:Shipment",
        "cargo:pieces": [piece()],
      },
    },
  };
}

describe("notificationsToWaybills", () => {
  it("returns empty waybill and piece arrays for an empty batch", async () => {
    const fetchEmbedded = vi.fn();

    const result = await notificationsToWaybills([], fetchEmbedded);

    expect(result).toEqual({ waybills: [], pieces: [] });
    expect(fetchEmbedded).not.toHaveBeenCalled();
  });

  it("adapts a HOUSE waybill with PER SHC and cm piece dimensions", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue(waybill());

    const result = await notificationsToWaybills(
      [notification("Waybill", "urn:waybill:house")],
      fetchEmbedded,
    );

    expect(result.waybills[0]).toMatchObject({
      "@id": "urn:waybill:house",
      "@type": "Waybill",
      waybillPrefix: "176",
      waybillNumber: "12345675",
      shc: "PER",
      pieces: [
        {
          "@id": "urn:piece:1",
          dimensions: { length: 120, width: 64, height: 60, unit: "cm" },
          grossWeight: { value: 25, unit: "kg" },
          ofShipment: "urn:shipment:1",
        },
      ],
    });
    expect(Object.keys(result.waybills[0].pieces[0])).not.toContain(
      "internal:temperatureProfile",
    );
  });

  it("skips malformed waybills missing waybillNumber", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue({
      "@id": "urn:waybill:bad",
      "@type": "cargo:Waybill",
    });

    const result = await notificationsToWaybills(
      [notification("Waybill", "urn:waybill:bad")],
      fetchEmbedded,
    );

    expect(result.waybills).toEqual([]);
    expect(result.pieces).toEqual([]);
  });

  it("dedupes multiple notifications for the same waybill", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue(waybill("urn:waybill:dupe"));

    const result = await notificationsToWaybills(
      [
        notification("Waybill", "urn:waybill:dupe"),
        notification("Waybill", "urn:waybill:dupe"),
      ],
      fetchEmbedded,
    );

    expect(result.waybills).toHaveLength(2);
    expect(result.waybills.filter((entry) => entry["@id"] === "urn:waybill:dupe")).toHaveLength(1);
    expect(result.pieces).toHaveLength(1);
  });

  it("skips pieces missing ofShipment but keeps the parent waybill", async () => {
    const badPiece = piece("urn:piece:missing-shipment");
    delete badPiece["cargo:ofShipment"];
    const fetchEmbedded = vi.fn().mockResolvedValue({
      ...waybill(),
      "cargo:masterWaybill": {
        "@id": "urn:waybill:master",
        "@type": "cargo:Waybill",
        "cargo:waybillNumber": "176-87654321",
        "cargo:shipment": {
          "@id": "urn:shipment:1",
          "@type": "cargo:Shipment",
          "cargo:pieces": [badPiece],
        },
      },
    });

    const result = await notificationsToWaybills(
      [notification("Waybill", "urn:waybill:house")],
      fetchEmbedded,
    );

    expect(result.waybills[0].pieces).toEqual([]);
    expect(result.waybills).not.toEqual([]);
    expect(result.pieces).toEqual([]);
  });

  it("coerces CMT dimension IRIs to canonical cm dimensions", () => {
    const result = adaptOneConnectPiece(piece());

    expect(result?.dimensions).toEqual({
      length: 120,
      width: 64,
      height: 60,
      unit: "cm",
    });
  });
});
