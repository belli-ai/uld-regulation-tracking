import { z } from "zod";

import { statusFromWebhookEvent } from "@/lib/adapters/dg-autocheck/acceptance-check";
import {
  patchStoredDgAutocheckCheck,
  rememberWebhookEvent,
} from "@/lib/adapters/dg-autocheck/state";
import { verifyDgAutocheckSignature } from "@/lib/adapters/dg-autocheck/webhook-verify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookSchema = z.object({
  acceptanceCheckId: z.string().min(1),
  attempt: z.number().int().nonnegative(),
  event: z.string().min(1),
  eventLogId: z.string().min(1),
});

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verificationToken = process.env.DG_AUTOCHECK_VERIFICATION_TOKEN?.trim();

  if (!verificationToken) {
    return Response.json(
      { error: "DG_AUTOCHECK_VERIFICATION_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const verified = verifyDgAutocheckSignature(
    rawBody,
    req.headers.get("x-dgautocheck-signature"),
    verificationToken,
  );

  if (!verified) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid webhook payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!rememberWebhookEvent(parsed.data)) {
    return Response.json({ duplicate: true, ok: true });
  }

  const nextStatus = statusFromWebhookEvent(parsed.data.event);
  if (nextStatus) {
    patchStoredDgAutocheckCheck(parsed.data.acceptanceCheckId, {
      ...nextStatus,
      vendorStatus: parsed.data.event,
    });
  }

  return Response.json({ ok: true });
}
