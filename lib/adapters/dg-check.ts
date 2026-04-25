import {
  toIRI,
  type DgDeclaration,
  type IRI,
  type Location,
  type Piece,
} from "@/lib/ontology/one-record";

export type DgValidationStatus = "non-dg" | "valid" | "rejected";

export type DgValidationResult = {
  pieceIri: IRI;
  status: DgValidationStatus;
  declaration?: DgDeclaration;
  reason?: string;
};

export type AircraftCategory = "passenger" | "cargo";

export type DgCheckRequest = {
  pieces: Piece[];
  departure: Location;
  arrival: Location;
  flight?: { flightNumber: string; aircraftCategory: AircraftCategory };
};

type RawDgFixture = {
  "@id"?: unknown;
  issuedForPiece?: unknown;
  declarationDate?: unknown;
  declarationPlace?: unknown;
  departureLocation?: unknown;
  arrivalLocation?: unknown;
  shipmentLimitation?: unknown;
  aircraftLimitationInformation?: unknown;
  exclusiveUseIndicator?: unknown;
  shippingRefNo?: unknown;
  complianceDeclarationText?: unknown;
};

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`dg-check adapter: missing or invalid '${field}'`);
  }
  return value;
}

function deriveAircraftLimitationText(raw: RawDgFixture): string | undefined {
  if (
    typeof raw.aircraftLimitationInformation === "string" &&
    raw.aircraftLimitationInformation.length > 0
  ) {
    return raw.aircraftLimitationInformation;
  }
  if (raw.shipmentLimitation === "CARGO_AIRCRAFT_ONLY") {
    return "Cargo aircraft only";
  }
  if (raw.shipmentLimitation === "PASSENGER_AND_CARGO") {
    return "Passenger and cargo aircraft";
  }
  return undefined;
}

export function adaptDgDeclaration(raw: RawDgFixture): DgDeclaration {
  const declaration: DgDeclaration = {
    "@id": toIRI(asString(raw["@id"], "dg.@id")),
    "@type": "DgDeclaration",
    issuedForPiece: toIRI(asString(raw.issuedForPiece, "issuedForPiece")),
    declarationDate: asString(raw.declarationDate, "declarationDate"),
    declarationPlace: toIRI(
      typeof raw.declarationPlace === "string" &&
        raw.declarationPlace.length > 0
        ? raw.declarationPlace
        : asString(raw.departureLocation, "departureLocation"),
    ),
    departureLocation: toIRI(
      asString(raw.departureLocation, "departureLocation"),
    ),
    arrivalLocation: toIRI(asString(raw.arrivalLocation, "arrivalLocation")),
  };
  const aircraftLimitation = deriveAircraftLimitationText(raw);
  if (aircraftLimitation) {
    declaration.aircraftLimitationInformation = aircraftLimitation;
  }
  if (typeof raw.exclusiveUseIndicator === "boolean") {
    declaration.exclusiveUseIndicator = raw.exclusiveUseIndicator;
  }
  if (typeof raw.shippingRefNo === "string" && raw.shippingRefNo.length > 0) {
    declaration.shippingRefNo = raw.shippingRefNo;
  }
  if (
    typeof raw.complianceDeclarationText === "string" &&
    raw.complianceDeclarationText.length > 0
  ) {
    declaration.complianceDeclarationText = raw.complianceDeclarationText;
  }
  return declaration;
}

export function buildPieceIriIndex(
  fixtures: Record<string, RawDgFixture>,
): Map<string, DgDeclaration> {
  const index = new Map<string, DgDeclaration>();
  for (const fixture of Object.values(fixtures)) {
    const piece = fixture.issuedForPiece;
    if (typeof piece !== "string" || piece.length === 0) continue;
    index.set(piece, adaptDgDeclaration(fixture));
  }
  return index;
}

function isCaoOnly(declaration: DgDeclaration): boolean {
  return (declaration.aircraftLimitationInformation ?? "")
    .toLowerCase()
    .includes("cargo aircraft only");
}

export function evaluateDgCheck(
  request: DgCheckRequest,
  pieceIriIndex: Map<string, DgDeclaration>,
): DgValidationResult[] {
  return request.pieces.map((piece) => {
    const declaration = pieceIriIndex.get(piece["@id"]);
    if (!declaration) {
      return { pieceIri: piece["@id"], status: "non-dg" };
    }
    if (!isCaoOnly(declaration)) {
      return { pieceIri: piece["@id"], status: "valid", declaration };
    }
    if (request.flight?.aircraftCategory === "passenger") {
      return {
        pieceIri: piece["@id"],
        status: "rejected",
        declaration,
        reason: "CAO-only DG on passenger aircraft",
      };
    }
    return { pieceIri: piece["@id"], status: "valid", declaration };
  });
}

// TODO(M23): swap to real DG AutoCheck Connect API. Replace fixture lookup with
// async acceptance-check creation + webhook-driven status; preserve the
// DgValidationResult shape so downstream consumers do not change.
export function runStubDgCheck(
  request: DgCheckRequest,
  fixtures: Record<string, RawDgFixture>,
): DgValidationResult[] {
  const index = buildPieceIriIndex(fixtures);
  return evaluateDgCheck(request, index);
}
