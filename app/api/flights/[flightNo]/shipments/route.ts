import { promises as fs } from "node:fs";
import path from "node:path";
import { adaptMockShipmentsForFlight } from "@/lib/adapters/shipments";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ flightNo: string }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  const { flightNo } = await ctx.params;
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "shipments.json",
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const data = adaptMockShipmentsForFlight(JSON.parse(raw), flightNo);
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/flights/[flightNo]/shipments failed", err);
    return Response.json(
      { error: "shipments fixture unavailable" },
      { status: 503 },
    );
  }
}
