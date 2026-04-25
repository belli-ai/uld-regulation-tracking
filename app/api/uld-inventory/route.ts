import { adaptMockUldInventory } from "@/lib/adapters/uld-inventory";
import uldInventoryFixture from "@/public/data/uld-inventory.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = adaptMockUldInventory(uldInventoryFixture);
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/uld-inventory failed", err);
    return Response.json(
      { error: "uld-inventory fixture unavailable" },
      { status: 503 },
    );
  }
}
