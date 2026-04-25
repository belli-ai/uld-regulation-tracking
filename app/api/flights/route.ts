import { promises as fs } from "node:fs";
import path from "node:path";
import { adaptMockFlights } from "@/lib/adapters/flights";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "flights.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const data = adaptMockFlights(JSON.parse(raw));
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/flights failed", err);
    return Response.json(
      { error: "flights fixture unavailable" },
      { status: 503 },
    );
  }
}
