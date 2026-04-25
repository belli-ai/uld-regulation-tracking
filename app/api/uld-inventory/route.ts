import { promises as fs } from "node:fs";
import path from "node:path";
import { adaptMockUldInventory } from "@/lib/adapters/uld-inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "uld-inventory.json",
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const data = adaptMockUldInventory(JSON.parse(raw));
    return Response.json({ data });
  } catch (err) {
    console.error("GET /api/uld-inventory failed", err);
    return Response.json(
      { error: "uld-inventory fixture unavailable" },
      { status: 503 },
    );
  }
}
