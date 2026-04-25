import type { DgDeclaration, IRI } from "@/lib/ontology/one-record";

export type AcceptanceCheckStatus =
  | "awaiting-file"
  | "queued"
  | "scanning"
  | "processing-error"
  | "import-failure"
  | "verification-required"
  | "verification-in-progress"
  | "awaiting-document-check"
  | "documentation-check-in-progress"
  | "awaiting-packaging-check"
  | "packaging-check-in-progress"
  | "completed";

export type AcceptanceCheckSignOff = {
  result?: "passed" | "failed" | null;
  signedOffOn?: string | null;
};

export type AcceptanceCheck = {
  acceptanceCheckId: string;
  acceptanceCheckStatus?: AcceptanceCheckStatus | string;
  acceptanceCheckSignOff?: AcceptanceCheckSignOff | null;
  message?: string;
  requestedUrl?: string | null;
};

export type RequestUrlResponse = {
  requestedUrl?: string | null;
};

export type DgAutocheckWebhookEvent =
  | "acceptance-check-created"
  | "ocr-completed"
  | "xsdg-imported"
  | "acceptance-check-conflicted"
  | "verification-started"
  | "verification-completed"
  | "documentation-check-started"
  | "documentation-check-completed"
  | "acceptance-check-completed"
  | "acceptance-check-failed"
  | "acceptance-check-passed";

export type WebhookEvent = {
  acceptanceCheckId: string;
  attempt: number;
  event: DgAutocheckWebhookEvent | string;
  eventLogId: string;
};

export type StoredDgAutocheckCheck = {
  acceptanceCheckId: string;
  declaration?: DgDeclaration;
  pieceIri: IRI;
  reason?: string;
  requestedUrl?: string;
  requestedUrlExpiresAt?: string;
  status: "pending" | "valid" | "rejected";
  updatedAt: string;
  vendorStatus?: string;
};
