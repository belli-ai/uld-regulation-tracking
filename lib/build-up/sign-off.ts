import type { DgValidationResult } from "./dg-checker";
import {
  toIRI,
  type IRI,
  type Loading,
  type LogisticsEvent,
  type Piece,
  type ULD,
} from "../ontology/one-record";

type PieceWithValidationFields = Piece & {
  dgValidation?: DgValidationResult | { status?: unknown; reason?: unknown };
  dgValidationStatus?: unknown;
  dgValidationReason?: unknown;
};

function readValidationReason(value: unknown): string | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const candidate = value as { reason?: unknown };
  return typeof candidate.reason === "string" && candidate.reason.length > 0
    ? candidate.reason
    : null;
}

function toStationIri(station: string): IRI {
  return toIRI(station);
}

function findBlockingPiece(
  pieces: Piece[],
): { piece: Piece; reason: string; status: "pending" | "rejected" } | null {
  for (const piece of pieces) {
    const candidate = piece as PieceWithValidationFields;
    const validationStatus =
      typeof candidate.dgValidationStatus === "string"
        ? candidate.dgValidationStatus
        : typeof candidate.dgValidation?.status === "string"
          ? candidate.dgValidation.status
          : null;

    if (validationStatus !== "rejected" && validationStatus !== "pending") {
      continue;
    }

    const reason =
      validationStatus === "pending"
        ? `DG validation pending for piece ${piece["@id"]}`
        : typeof candidate.dgValidationReason === "string" &&
            candidate.dgValidationReason.length > 0
          ? candidate.dgValidationReason
          : (readValidationReason(candidate.dgValidation) ??
            `DG validation rejected for piece ${piece["@id"]}`);

    return { piece, reason, status: validationStatus };
  }

  return null;
}

function createActionIri(kind: "loading" | "event", uld: ULD, at: string): IRI {
  const suffix = at.replace(/[:.]/g, "-");
  return toIRI(`urn:cargo:${kind}:${uld.uldSerialNumber}:${suffix}`);
}

export function signOff(
  uld: ULD,
  contents: Piece[],
  sealNumber: string,
  station: string,
  options?: { allowRejected?: boolean },
): { loading: Loading; event: LogisticsEvent } {
  const blocking = findBlockingPiece(contents);
  if (blocking && (blocking.status === "pending" || !options?.allowRejected)) {
    throw new Error(blocking.reason);
  }

  const now = new Date().toISOString();
  const performedAt = toStationIri(station);

  const loading: Loading = {
    "@id": createActionIri("loading", uld, now),
    "@type": "Loading",
    loadedPieces: contents.map((piece) => piece["@id"]),
    loadedUnits: [uld["@id"]],
    actionStartTime: now,
    actionEndTime: now,
    performedAt,
    loadingType: "build-up",
  };

  if (sealNumber.length > 0) {
    loading.otherIdentifiers = [`seal:${sealNumber}`];
  }

  const event: LogisticsEvent = {
    "@id": createActionIri("event", uld, now),
    "@type": "LogisticsEvent",
    eventCode: "BUILD_UP_COMPLETE",
    eventName: "Build-up complete",
    eventDate: now,
    eventFor: uld["@id"],
    eventLocation: performedAt,
    eventTimeType: "actual",
  };

  return { loading, event };
}
