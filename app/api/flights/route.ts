import { adaptMockFlights } from "@/lib/adapters/flights";
import flightsFixture from "@/public/data/flights.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = adaptMockFlights(flightsFixture);
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/flights failed", err);
    return Response.json(
      { error: "flights fixture unavailable" },
      { status: 503 },
    );
  }
}
