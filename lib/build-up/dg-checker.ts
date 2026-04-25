import {
  adaptDgDeclaration,
  type DgCheckRequest,
  type DgValidationResult as AdapterDgValidationResult,
} from "../adapters/dg-check";
import {
  toIRI,
  type DgDeclaration,
  type Location,
  type Piece,
} from "../ontology/one-record";

type NonDgValidationResult = {
  piece: Piece;
  status: "non-dg";
};

type ValidDgValidationResult = {
  piece: Piece;
  status: "valid";
  declaration: DgDeclaration;
};

type RejectedDgValidationResult = {
  piece: Piece;
  status: "rejected";
  declaration: DgDeclaration;
  reason: string;
};

export type DgValidationResult =
  | NonDgValidationResult
  | ValidDgValidationResult
  | RejectedDgValidationResult;

type RawDgCheckResponse =
  | AdapterDgValidationResult[]
  | {
      results?: AdapterDgValidationResult[] | unknown;
    };

function toLocation(station: string): Location {
  const locationCode = station.startsWith("urn:")
    ? station.split(":").at(-1) ?? station
    : station;
  const iri = station.startsWith("urn:") ? station : `urn:cargo:loc:${station}`;

  return {
    "@id": toIRI(iri),
    "@type": "Location",
    name: locationCode,
    locationCode,
  };
}

function inferAircraftCategory(flight: string): "cargo" | "passenger" {
  return /\bcargo\b|cao/i.test(flight) ? "cargo" : "passenger";
}

function asResultList(payload: RawDgCheckResponse): AdapterDgValidationResult[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.results)) {
    return payload.results.filter(
      (result): result is AdapterDgValidationResult =>
        typeof result === "object" && result !== null,
    );
  }
  return [];
}

function toDeclaration(value: unknown): DgDeclaration | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }
  return adaptDgDeclaration(value as Record<string, unknown>);
}

function normalizeResult(
  piece: Piece,
  result?: AdapterDgValidationResult,
): DgValidationResult {
  if (!result || result.status === "non-dg") {
    return { piece, status: "non-dg" };
  }

  const declaration = toDeclaration(result.declaration);
  if (!declaration) {
    return { piece, status: "non-dg" };
  }

  if (result.status === "rejected") {
    return {
      piece,
      status: "rejected",
      declaration,
      reason: result.reason?.trim() || "DG validation rejected",
    };
  }

  return {
    piece,
    status: "valid",
    declaration,
  };
}

export const dgChecker = {
  async validate(
    pieces: Piece[],
    departure: string,
    arrival: string,
    flight: string,
  ): Promise<DgValidationResult[]> {
    if (pieces.length === 0) {
      return [];
    }

    const request: DgCheckRequest = {
      pieces,
      departure: toLocation(departure),
      arrival: toLocation(arrival),
      flight: {
        flightNumber: flight,
        aircraftCategory: inferAircraftCategory(flight),
      },
    };

    const response = await fetch("/api/dg/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`DG check failed with status ${response.status}`);
    }

    const payload = (await response.json()) as RawDgCheckResponse;
    const byPieceIri = new Map(
      asResultList(payload).map((result) => [result.pieceIri, result] as const),
    );

    return pieces.map((piece) => normalizeResult(piece, byPieceIri.get(piece["@id"])));
  },
};
