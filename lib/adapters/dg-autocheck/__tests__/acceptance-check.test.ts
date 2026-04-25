import { describe, expect, it } from "vitest";

import {
  statusFromAcceptanceCheck,
  statusFromWebhookEvent,
} from "../acceptance-check";

describe("DG AutoCheck status mapping", () => {
  it("maps completed passed checks to valid", () => {
    expect(
      statusFromAcceptanceCheck({
        acceptanceCheckId: "AC-1",
        acceptanceCheckSignOff: { result: "passed" },
        acceptanceCheckStatus: "completed",
      }),
    ).toEqual({ status: "valid", vendorStatus: "completed" });
  });

  it("maps completed failed checks to rejected", () => {
    expect(
      statusFromAcceptanceCheck({
        acceptanceCheckId: "AC-1",
        acceptanceCheckSignOff: { result: "failed" },
        acceptanceCheckStatus: "completed",
      }),
    ).toEqual({
      reason: "DG AutoCheck sign-off failed",
      status: "rejected",
      vendorStatus: "completed",
    });
  });

  it("maps pass and fail webhooks without blocking the ACK on a read", () => {
    expect(statusFromWebhookEvent("acceptance-check-passed")).toEqual({
      status: "valid",
    });
    expect(statusFromWebhookEvent("acceptance-check-failed")).toEqual({
      reason: "DG AutoCheck sign-off failed",
      status: "rejected",
    });
  });
});
