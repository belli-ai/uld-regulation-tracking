import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  runStubDgCheck,
  type DgCheckRequest,
  type DgValidationResult,
} from "@/lib/adapters/dg-check";
import { toIRI } from "@/lib/ontology/one-record";

export const dynamic = "force-dynamic";

const pieceSchema = z
  .object({
    "@id": z.string().min(1),
    "@type": z.literal("Piece"),
    grossWeight: z.object({
      value: z.number(),
      unit: z.union([z.literal("kg"), z.literal("lb")]),
    }),
    ofShipment: z.string().min(1),
  })
  .passthrough();

const locationSchema = z
  .object({
    "@id": z.string().min(1),
    "@type": z.literal("Location"),
    name: z.string(),
  })
  .passthrough();

const flightSchema = z.object({
  flightNumber: z.string().min(1),
  aircraftCategory: z.union([z.literal("passenger"), z.literal("cargo")]),
});

const requestSchema = z.object({
  pieces: z.array(pieceSchema),
  departure: locationSchema,
  arrival: locationSchema,
  flight: flightSchema.optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let fixtures: Record<string, unknown> = {};
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "dg-declarations.json",
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      fixtures = json as Record<string, unknown>;
    }
  } catch (err) {
    // No fixture file yet (M2 may still be landing). Treat all pieces as non-dg.
    console.warn(
      "GET dg-declarations.json unavailable; treating as empty",
      err,
    );
  }

  const request: DgCheckRequest = {
    pieces: parsed.data.pieces.map((piece) => ({
      ...piece,
      "@id": toIRI(piece["@id"]),
      "@type": "Piece",
      ofShipment: toIRI(piece.ofShipment),
    })),
    departure: {
      ...parsed.data.departure,
      "@id": toIRI(parsed.data.departure["@id"]),
      "@type": "Location",
    },
    arrival: {
      ...parsed.data.arrival,
      "@id": toIRI(parsed.data.arrival["@id"]),
      "@type": "Location",
    },
    flight: parsed.data.flight,
  };

  const results: DgValidationResult[] = runStubDgCheck(
    request,
    fixtures as Parameters<typeof runStubDgCheck>[1],
  );
  return Response.json({ results });
}
