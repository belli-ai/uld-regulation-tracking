import { describe, expect, it } from "vitest";
import { signOff } from "../sign-off";
import { toIRI, type Piece, type ULD } from "../../ontology/one-record";

type BuildUpPiece = Piece & {
  dgValidation?: {
    status: "valid" | "rejected";
    reason?: string;
  };
};

function makeUld(): ULD {
  return {
    "@id": toIRI("urn:cargo:uld:AKE-12345EK"),
    "@type": "ULD",
    uldSerialNumber: "AKE-12345EK",
    uldTypeCode: "AKE",
    serviceabilityCode: "SER",
    damageFlag: false,
    ownerCode: "EK",
  };
}

function makePiece(id: string, status: "valid" | "rejected" = "valid"): BuildUpPiece {
  return {
    "@id": toIRI(id),
    "@type": "Piece",
    grossWeight: { value: 1, unit: "kg" },
    ofShipment: toIRI("urn:cargo:shipment:test"),
    dgValidation: {
      status,
      reason:
        status === "rejected" ? "CAO-only DG on passenger aircraft" : undefined,
    },
  };
}

describe("signOff", () => {
  it("blocks sign-off when any piece has been rejected by DG validation", () => {
    expect(() =>
      signOff(
        makeUld(),
        [makePiece("urn:cargo:piece:dg-rejected-1", "rejected")],
        "SEAL-001",
        "warehouse-cool-room",
      ),
    ).toThrow("CAO-only DG on passenger aircraft");
  });

  it("emits the canonical Loading shape for a successful sign-off", () => {
    const pieces = [
      makePiece("urn:cargo:piece:valid-1"),
      makePiece("urn:cargo:piece:valid-2"),
    ];

    const result = signOff(makeUld(), pieces, "SEAL-002", "warehouse-cool-room");

    expect(result.loading.loadedPieces).toEqual(pieces.map((piece) => piece["@id"]));
    expect(result.loading.loadedUnits).toEqual([makeUld()["@id"]]);
    expect(new Date(result.loading.actionStartTime).toISOString()).toBe(
      result.loading.actionStartTime,
    );
    expect(new Date(result.loading.actionEndTime ?? "").toISOString()).toBe(
      result.loading.actionEndTime,
    );
    expect(result.loading.performedAt).toBe("warehouse-cool-room");
    expect(result.event.eventCode).toBe("BUILD_UP_COMPLETE");
    expect(result.event.eventFor).toBe(makeUld()["@id"]);
  });
});
