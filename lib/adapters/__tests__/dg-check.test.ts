import { describe, expect, it } from "vitest";
import {
  adaptDgDeclaration,
  buildPieceIriIndex,
  evaluateDgCheck,
  type DgCheckRequest,
} from "@/lib/adapters/dg-check";
import { toIRI, type Location, type Piece } from "@/lib/ontology/one-record";

const FIXTURES = {
  "urn:cargo:dgdec:DG-LITHIUM-001": {
    "@id": "urn:cargo:dgdec:DG-LITHIUM-001",
    "@type": "DgDeclaration",
    issuedForPiece: "urn:cargo:piece:176-45678901-1",
    declarationDate: "2026-04-25T08:00:00+04:00",
    departureLocation: "urn:cargo:loc:DXB",
    arrivalLocation: "urn:cargo:loc:FRA",
    shipmentLimitation: "CARGO_AIRCRAFT_ONLY",
    shippingRefNo: "TS-LION-9912",
  },
  "urn:cargo:dgdec:DG-PASSENGER-OK": {
    "@id": "urn:cargo:dgdec:DG-PASSENGER-OK",
    "@type": "DgDeclaration",
    issuedForPiece: "urn:cargo:piece:176-45678901-2",
    declarationDate: "2026-04-25T08:00:00+04:00",
    departureLocation: "urn:cargo:loc:DXB",
    arrivalLocation: "urn:cargo:loc:FRA",
    shipmentLimitation: "PASSENGER_AND_CARGO",
  },
};

const piece = (iri: string): Piece => ({
  "@id": toIRI(iri),
  "@type": "Piece",
  grossWeight: { value: 1, unit: "kg" },
  ofShipment: toIRI("urn:cargo:waybill:test"),
});

const departure: Location = {
  "@id": toIRI("urn:cargo:loc:DXB"),
  "@type": "Location",
  name: "Dubai International",
};
const arrival: Location = {
  "@id": toIRI("urn:cargo:loc:FRA"),
  "@type": "Location",
  name: "Frankfurt Main",
};

describe("adaptDgDeclaration", () => {
  it("derives aircraftLimitationInformation from CAO shipmentLimitation", () => {
    const dec = adaptDgDeclaration(FIXTURES["urn:cargo:dgdec:DG-LITHIUM-001"]);
    expect(dec["@type"]).toBe("DgDeclaration");
    expect(dec.aircraftLimitationInformation?.toLowerCase()).toContain(
      "cargo aircraft only",
    );
    expect(dec.shippingRefNo).toBe("TS-LION-9912");
  });

  it("derives non-CAO text for PASSENGER_AND_CARGO", () => {
    const dec = adaptDgDeclaration(FIXTURES["urn:cargo:dgdec:DG-PASSENGER-OK"]);
    expect(dec.aircraftLimitationInformation?.toLowerCase()).not.toContain(
      "cargo aircraft only",
    );
  });
});

describe("evaluateDgCheck stub rule table", () => {
  const index = buildPieceIriIndex(FIXTURES);

  function run(req: DgCheckRequest) {
    return evaluateDgCheck(req, index);
  }

  it("returns non-dg when piece IRI is not in fixtures", () => {
    const result = run({
      pieces: [piece("urn:cargo:piece:non-dg-1")],
      departure,
      arrival,
      flight: { flightNumber: "EK0083", aircraftCategory: "passenger" },
    });
    expect(result[0]).toEqual({
      pieceIri: "urn:cargo:piece:non-dg-1",
      status: "non-dg",
    });
  });

  it("returns valid when DGD is not CAO regardless of aircraft category", () => {
    const result = run({
      pieces: [piece("urn:cargo:piece:176-45678901-2")],
      departure,
      arrival,
      flight: { flightNumber: "EK0083", aircraftCategory: "passenger" },
    });
    expect(result[0].status).toBe("valid");
    expect(result[0].declaration?.["@id"]).toBe(
      "urn:cargo:dgdec:DG-PASSENGER-OK",
    );
  });

  it("rejects CAO-only DGD on passenger aircraft", () => {
    const result = run({
      pieces: [piece("urn:cargo:piece:176-45678901-1")],
      departure,
      arrival,
      flight: { flightNumber: "EK0083", aircraftCategory: "passenger" },
    });
    expect(result[0].status).toBe("rejected");
    expect(result[0].reason).toBe("CAO-only DG on passenger aircraft");
    expect(result[0].declaration?.["@id"]).toBe(
      "urn:cargo:dgdec:DG-LITHIUM-001",
    );
  });

  it("returns valid for CAO-only DGD on cargo aircraft", () => {
    const result = run({
      pieces: [piece("urn:cargo:piece:176-45678901-1")],
      departure,
      arrival,
      flight: { flightNumber: "EK0083", aircraftCategory: "cargo" },
    });
    expect(result[0].status).toBe("valid");
    expect(result[0].declaration?.["@id"]).toBe(
      "urn:cargo:dgdec:DG-LITHIUM-001",
    );
  });
});
