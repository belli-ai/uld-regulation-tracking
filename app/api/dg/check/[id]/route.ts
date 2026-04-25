import { readAndStoreAcceptanceCheck } from "@/lib/adapters/dg-autocheck/acceptance-check";
import {
  getStoredDgAutocheckCheck,
  toDgValidationResult,
} from "@/lib/adapters/dg-autocheck/state";
import { getDgCheckMode } from "@/lib/adapters/dg-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: Context) {
  const { id } = await context.params;
  const stored = getStoredDgAutocheckCheck(id);

  if (!stored) {
    return Response.json(
      { error: "acceptance check not found" },
      { status: 404 },
    );
  }

  if (getDgCheckMode() !== "autocheck") {
    return Response.json({ result: toDgValidationResult(stored) });
  }

  try {
    const result = await readAndStoreAcceptanceCheck(id);
    return Response.json({
      result: result ?? toDgValidationResult(stored),
    });
  } catch (error) {
    console.error("DG AutoCheck status poll failed", error);
    return Response.json({ result: toDgValidationResult(stored) });
  }
}
