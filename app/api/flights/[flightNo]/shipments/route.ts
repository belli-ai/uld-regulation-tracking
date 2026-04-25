import { adaptMockShipmentsForFlight } from "@/lib/adapters/shipments";
import shipmentsFixture from "@/public/data/shipments.json";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ flightNo: string }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  const { flightNo } = await ctx.params;
  try {
    const data = adaptMockShipmentsForFlight(shipmentsFixture, flightNo);
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/flights/[flightNo]/shipments failed", err);
    return Response.json(
      { error: "shipments fixture unavailable" },
      { status: 503 },
    );
  }
}
