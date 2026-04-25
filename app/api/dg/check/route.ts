import { z } from "zod";
import {
  getDgCheckMode,
  runStubDgCheck,
  type DgCheckRequest,
  type DgValidationResult,
} from "@/lib/adapters/dg-check";
import { runAutocheckDgCheck } from "@/lib/adapters/dg-autocheck/acceptance-check";
import { DgAutocheckHttpError } from "@/lib/adapters/dg-autocheck/client";
import { toIRI } from "@/lib/ontology/one-record";
import dgDeclarationsFixture from "@/public/data/dg-declarations.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const fixtures: Record<string, unknown> =
    dgDeclarationsFixture &&
    typeof dgDeclarationsFixture === "object" &&
    !Array.isArray(dgDeclarationsFixture)
      ? (dgDeclarationsFixture as Record<string, unknown>)
      : {};

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

  try {
    const results: DgValidationResult[] =
      getDgCheckMode() === "autocheck"
        ? await runAutocheckDgCheck(
            request,
            fixtures as Parameters<typeof runAutocheckDgCheck>[1],
          )
        : runStubDgCheck(
            request,
            fixtures as Parameters<typeof runStubDgCheck>[1],
          );

    return Response.json({ mode: getDgCheckMode(), results });
  } catch (error) {
    console.error("DG check adapter failed", error);
    if (error instanceof DgAutocheckHttpError) {
      return Response.json(
        {
          error: error.message,
          upstreamStatus: error.status,
          upstreamResponse: error.responseText || undefined,
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "DG validation request failed",
      },
      { status: 502 },
    );
  }
}
