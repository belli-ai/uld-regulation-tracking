import type { DgFixtureMap, DgValidationResult } from "@/lib/adapters/dg-check";
import {
  buildPieceIriIndex,
  evaluateDgCheck,
  type DgCheckRequest,
} from "@/lib/adapters/dg-check";
import type { DgDeclaration, Piece } from "@/lib/ontology/one-record";

import {
  dgAutocheckFetch,
  getDgAutocheckConfig,
  readAcceptanceCheckJson,
  readJsonResponse,
} from "./client";
import {
  findStoredDgAutocheckCheckByPiece,
  getStoredDgAutocheckCheck,
  patchStoredDgAutocheckCheck,
  toDgValidationResult,
  upsertStoredDgAutocheckCheck,
} from "./state";
import type {
  AcceptanceCheck,
  RequestUrlResponse,
  StoredDgAutocheckCheck,
} from "./types";

type RawDgFixtureWithDocuments = DgFixtureMap[string] & {
  dgdPdfBase64?: unknown;
  xsdgXml?: unknown;
};

const TERMINAL_ERROR_STATUSES = new Set(["processing-error", "import-failure"]);

function findRawFixture(
  fixtures: DgFixtureMap,
  declaration: DgDeclaration,
): RawDgFixtureWithDocuments | null {
  return (fixtures[declaration["@id"]] as RawDgFixtureWithDocuments) ?? null;
}

function requestedUrlExpiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function statusFromAcceptanceCheck(
  check: AcceptanceCheck,
): Pick<StoredDgAutocheckCheck, "reason" | "status" | "vendorStatus"> {
  const vendorStatus = check.acceptanceCheckStatus;
  const signOff = check.acceptanceCheckSignOff?.result;

  if (vendorStatus && TERMINAL_ERROR_STATUSES.has(vendorStatus)) {
    return {
      reason: check.message ?? `DG AutoCheck ended in ${vendorStatus}`,
      status: "rejected",
      vendorStatus,
    };
  }

  if (vendorStatus === "completed" && signOff === "passed") {
    return { status: "valid", vendorStatus };
  }

  if (vendorStatus === "completed" && signOff === "failed") {
    return {
      reason: check.message ?? "DG AutoCheck sign-off failed",
      status: "rejected",
      vendorStatus,
    };
  }

  return { status: "pending", vendorStatus };
}

export function statusFromWebhookEvent(
  event: string,
): Pick<StoredDgAutocheckCheck, "reason" | "status"> | null {
  if (event === "acceptance-check-passed") {
    return { status: "valid" };
  }

  if (event === "acceptance-check-failed") {
    return { reason: "DG AutoCheck sign-off failed", status: "rejected" };
  }

  return null;
}

async function createAcceptanceCheck(): Promise<AcceptanceCheck> {
  const config = getDgAutocheckConfig();
  const body = new URLSearchParams({
    officeIdentifier: config.officeIdentifier,
  });
  const response = await dgAutocheckFetch("/api/v1/acceptance-checks", {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return readAcceptanceCheckJson(response, "create acceptance check");
}

async function requestAcceptanceCheckUrl(
  acceptanceCheckId: string,
): Promise<string> {
  const config = getDgAutocheckConfig();
  const body = new URLSearchParams({
    userIdentifier: config.userIdentifier,
  });
  const response = await dgAutocheckFetch(
    `/api/v1/acceptance-checks/${encodeURIComponent(
      acceptanceCheckId,
    )}/request-url`,
    {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );
  const payload = await readJsonResponse<RequestUrlResponse>(
    response,
    "request acceptance check URL",
  );

  if (typeof payload.requestedUrl !== "string" || !payload.requestedUrl) {
    throw new Error("DG AutoCheck request-url response did not include a URL");
  }

  return payload.requestedUrl;
}

async function uploadPreIssuedDeclaration(
  acceptanceCheckId: string,
  fixture: RawDgFixtureWithDocuments | null,
): Promise<void> {
  if (typeof fixture?.xsdgXml === "string" && fixture.xsdgXml.length > 0) {
    const response = await dgAutocheckFetch(
      `/api/v1/acceptance-checks/${encodeURIComponent(
        acceptanceCheckId,
      )}/import/xsdg`,
      {
        body: fixture.xsdgXml,
        headers: {
          "content-type": "application/xml",
        },
        method: "PUT",
      },
    );
    await readJsonResponse<unknown>(response, "import XSDG");
    return;
  }

  if (
    typeof fixture?.dgdPdfBase64 === "string" &&
    fixture.dgdPdfBase64.length > 0
  ) {
    const response = await dgAutocheckFetch(
      `/api/v1/acceptance-checks/${encodeURIComponent(
        acceptanceCheckId,
      )}/scan-dgd/pdf`,
      {
        body: Buffer.from(fixture.dgdPdfBase64, "base64"),
        headers: {
          "content-type": "application/pdf",
        },
        method: "PUT",
      },
    );
    await readJsonResponse<unknown>(response, "scan DGD PDF");
  }
}

async function beginPieceAutocheck(
  piece: Piece,
  declaration: DgDeclaration,
  fixture: RawDgFixtureWithDocuments | null,
): Promise<DgValidationResult> {
  const created = await createAcceptanceCheck();
  await uploadPreIssuedDeclaration(created.acceptanceCheckId, fixture);
  const requestedUrl =
    typeof created.requestedUrl === "string" && created.requestedUrl.length > 0
      ? created.requestedUrl
      : await requestAcceptanceCheckUrl(created.acceptanceCheckId);

  const stored = upsertStoredDgAutocheckCheck({
    acceptanceCheckId: created.acceptanceCheckId,
    declaration,
    pieceIri: piece["@id"],
    requestedUrl,
    requestedUrlExpiresAt: requestedUrlExpiresAt(),
    status: "pending",
    updatedAt: new Date().toISOString(),
    vendorStatus: created.acceptanceCheckStatus,
  });

  return toDgValidationResult(stored);
}

export async function runAutocheckDgCheck(
  request: DgCheckRequest,
  fixtures: DgFixtureMap,
): Promise<DgValidationResult[]> {
  const declarationByPiece = buildPieceIriIndex(fixtures);
  const stubResults = evaluateDgCheck(request, declarationByPiece);

  return Promise.all(
    request.pieces.map(async (piece) => {
      const declaration = declarationByPiece.get(piece["@id"]);
      if (!declaration) {
        return { pieceIri: piece["@id"], status: "non-dg" };
      }

      const rejectedByStaticRules = stubResults.find(
        (result) =>
          result.pieceIri === piece["@id"] && result.status === "rejected",
      );
      if (rejectedByStaticRules) {
        return rejectedByStaticRules;
      }

      const existing = findStoredDgAutocheckCheckByPiece(piece["@id"]);
      if (existing) {
        return toDgValidationResult(existing);
      }

      return beginPieceAutocheck(
        piece,
        declaration,
        findRawFixture(fixtures, declaration),
      );
    }),
  );
}

export async function readAndStoreAcceptanceCheck(
  acceptanceCheckId: string,
): Promise<DgValidationResult | null> {
  const stored = getStoredDgAutocheckCheck(acceptanceCheckId);
  if (!stored) {
    return null;
  }

  const response = await dgAutocheckFetch(
    `/api/v1/acceptance-checks/${encodeURIComponent(acceptanceCheckId)}`,
    { method: "GET" },
  );
  const check = await readAcceptanceCheckJson(
    response,
    "read acceptance check",
  );
  const next = patchStoredDgAutocheckCheck(
    acceptanceCheckId,
    statusFromAcceptanceCheck(check),
  );

  return next ? toDgValidationResult(next) : null;
}

export { statusFromAcceptanceCheck };
