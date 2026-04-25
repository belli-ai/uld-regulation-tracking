import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import { verifyDgAutocheckSignature } from "../webhook-verify";

describe("verifyDgAutocheckSignature", () => {
  it("accepts the SHA-256 hash of token plus raw body", () => {
    const token = "verification-token";
    const rawBody = JSON.stringify({ acceptanceCheckId: "AC-123" });
    const signature = createHash("sha256")
      .update(`${token}${rawBody}`)
      .digest("hex");

    expect(verifyDgAutocheckSignature(rawBody, signature, token)).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    expect(
      verifyDgAutocheckSignature(
        '{"acceptanceCheckId":"AC-123"}',
        "0".repeat(64),
        "verification-token",
      ),
    ).toBe(false);
  });
});
