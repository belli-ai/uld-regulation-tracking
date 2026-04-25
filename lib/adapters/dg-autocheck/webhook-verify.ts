import { createHash, timingSafeEqual } from "crypto";

export function verifyDgAutocheckSignature(
  rawBody: string,
  signatureHeader: string | null,
  verificationToken: string,
): boolean {
  if (!signatureHeader || verificationToken.length === 0) {
    return false;
  }

  const expected = createHash("sha256")
    .update(`${verificationToken}${rawBody}`)
    .digest("hex");

  const actual = signatureHeader.trim().toLowerCase();
  if (!/^[a-f0-9]+$/.test(actual) || actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(actual, "hex"),
  );
}
