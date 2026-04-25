import type { DgValidationResult } from "@/lib/adapters/dg-check";

import type { StoredDgAutocheckCheck, WebhookEvent } from "./types";

declare global {
  var __coolChainDgAutocheckChecks:
    | Map<string, StoredDgAutocheckCheck>
    | undefined;
  var __coolChainDgAutocheckEvents: Set<string> | undefined;
}

function checks(): Map<string, StoredDgAutocheckCheck> {
  globalThis.__coolChainDgAutocheckChecks ??= new Map();
  return globalThis.__coolChainDgAutocheckChecks;
}

function webhookEvents(): Set<string> {
  globalThis.__coolChainDgAutocheckEvents ??= new Set();
  return globalThis.__coolChainDgAutocheckEvents;
}

export function getStoredDgAutocheckCheck(
  acceptanceCheckId: string,
): StoredDgAutocheckCheck | null {
  return checks().get(acceptanceCheckId) ?? null;
}

export function findStoredDgAutocheckCheckByPiece(
  pieceIri: string,
): StoredDgAutocheckCheck | null {
  for (const check of checks().values()) {
    if (check.pieceIri === pieceIri) {
      return check;
    }
  }

  return null;
}

export function upsertStoredDgAutocheckCheck(
  check: StoredDgAutocheckCheck,
): StoredDgAutocheckCheck {
  checks().set(check.acceptanceCheckId, check);
  return check;
}

export function patchStoredDgAutocheckCheck(
  acceptanceCheckId: string,
  patch: Partial<
    Omit<StoredDgAutocheckCheck, "acceptanceCheckId" | "pieceIri">
  >,
): StoredDgAutocheckCheck | null {
  const current = getStoredDgAutocheckCheck(acceptanceCheckId);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return upsertStoredDgAutocheckCheck(next);
}

export function rememberWebhookEvent(event: WebhookEvent): boolean {
  const key = `${event.eventLogId}:${event.attempt}`;
  const seen = webhookEvents();
  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  return true;
}

export function toDgValidationResult(
  check: StoredDgAutocheckCheck,
): DgValidationResult {
  return {
    acceptanceCheckId: check.acceptanceCheckId,
    declaration: check.declaration,
    pieceIri: check.pieceIri,
    reason: check.reason,
    requestedUrl: check.requestedUrl,
    requestedUrlExpiresAt: check.requestedUrlExpiresAt,
    status: check.status,
    vendorStatus: check.vendorStatus,
  };
}
