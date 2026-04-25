import { afterEach, describe, expect, it, vi } from "vitest";
import { dgChecker } from "../dg-checker";
import {
  toIRI,
  type DgDeclaration,
  type Piece,
} from "../../ontology/one-record";

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

function makeDeclaration(
  id: string,
  pieceId: string,
  limitation: string,
): DgDeclaration {
  return {
    "@id": toIRI(id),
    "@type": "DgDeclaration",
    issuedForPiece: toIRI(pieceId),
    declarationDate: "2026-04-25T08:00:00Z",
    declarationPlace: toIRI("urn:cargo:loc:DXB"),
    departureLocation: toIRI("urn:cargo:loc:DXB"),
    arrivalLocation: toIRI("urn:cargo:loc:FRA"),
    aircraftLimitationInformation: limitation,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dgChecker.validate", () => {
  it("returns non-dg for COL and PER pieces when the DG check response is empty", async () => {
    const colPiece = makePiece("urn:cargo:piece:col-1", "COL", 2, 8);
    const perPiece = makePiece("urn:cargo:piece:per-1", "PER", 2, 8);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const result = await dgChecker.validate(
      [colPiece, perPiece],
      "DXB",
      "FRA",
      "EK0083",
    );

    expect(result).toEqual([
      { piece: colPiece, status: "non-dg" },
      { piece: perPiece, status: "non-dg" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dg/check",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns rejected for a CAO-only declaration on a passenger flight", async () => {
    const piece = makePiece("urn:cargo:piece:dg-cao-1", "CRT", 15, 25);
    const declaration = makeDeclaration(
      "urn:cargo:dgdec:DG-CAO-ONLY",
      piece["@id"],
      "Cargo aircraft only",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                pieceIri: piece["@id"],
                status: "rejected",
                declaration,
                reason: "CAO-only DG on passenger aircraft",
              },
            ]),
            { status: 200 },
          ),
      ),
    );

    const result = await dgChecker.validate([piece], "DXB", "FRA", "EK0083");

    expect(result).toEqual([
      {
        piece,
        status: "rejected",
        declaration,
        reason: "CAO-only DG on passenger aircraft",
      },
    ]);
  });

  it("returns valid when the declaration is compatible with the flight", async () => {
    const piece = makePiece("urn:cargo:piece:dg-valid-1", "COL", 2, 8);
    const declaration = makeDeclaration(
      "urn:cargo:dgdec:DG-PASSENGER-OK",
      piece["@id"],
      "Passenger and cargo aircraft",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                pieceIri: piece["@id"],
                status: "valid",
                declaration,
              },
            ]),
            { status: 200 },
          ),
      ),
    );

    const result = await dgChecker.validate([piece], "DXB", "FRA", "EK0083");

    expect(result).toEqual([{ piece, status: "valid", declaration }]);
  });

  it("returns pending when DG AutoCheck starts an acceptance check", async () => {
    const piece = makePiece("urn:cargo:piece:dg-pending-1", "COL", 2, 8);
    const declaration = makeDeclaration(
      "urn:cargo:dgdec:DG-PENDING",
      piece["@id"],
      "Passenger and cargo aircraft",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  acceptanceCheckId: "AC-123",
                  declaration,
                  pieceIri: piece["@id"],
                  requestedUrl: "https://dg.example/check/AC-123",
                  requestedUrlExpiresAt: "2026-04-25T08:10:00Z",
                  status: "pending",
                  vendorStatus: "awaiting-document-check",
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );

    const result = await dgChecker.validate([piece], "DXB", "FRA", "EK0083");

    expect(result).toEqual([
      {
        acceptanceCheckId: "AC-123",
        declaration,
        piece,
        requestedUrl: "https://dg.example/check/AC-123",
        requestedUrlExpiresAt: "2026-04-25T08:10:00Z",
        status: "pending",
        vendorStatus: "awaiting-document-check",
      },
    ]);
  });
});
