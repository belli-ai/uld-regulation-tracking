import type { DgValidationResult } from "@/lib/adapters/dg-check";
import { toIRI } from "@/lib/ontology/one-record";
import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

function buildDgRequestPayload(
  awbs: string[],
  ctx: RunnerContext,
  flightNo: string | null,
) {
  const pieces = awbs
    .map((awb) => ctx.getWaybill(awb))
    .filter((waybill): waybill is NonNullable<typeof waybill> => waybill !== null)
    .flatMap((waybill) => waybill.pieces);

  return {
    arrival: {
      "@id": toIRI("urn:cargo:loc:FRA"),
      "@type": "Location" as const,
      name: "FRA",
    },
    departure: {
      "@id": toIRI("urn:cargo:loc:DXB"),
      "@type": "Location" as const,
      name: "DXB",
    },
    flight:
      flightNo === null
        ? undefined
        : {
            aircraftCategory: "passenger" as const,
            flightNumber: flightNo,
          },
    pieces,
  };
}

export async function handleDgCheckComplete(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  if (typeof event.uldId !== "string") {
    return;
  }

  const uld = ctx.getUld(event.uldId);
  if (!uld) {
    return;
  }

  let nextStatus: "pass" | "fail" | "non-dg" = "pass";
  const payload = buildDgRequestPayload(uld.assignedAwbs, ctx, uld.flightNo);

  if (payload.pieces.length > 0) {
    try {
      const response = await fetch("/api/dg/check", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (response.ok) {
        const body = (await response.json()) as {
          results?: DgValidationResult[];
        };
        const results = body.results ?? [];
        const hasRejected = results.some((result) => result.status === "rejected");
        const hasValid = results.some((result) => result.status === "valid");
        nextStatus = hasRejected ? "fail" : hasValid ? "pass" : "non-dg";
      }
    } catch {
      nextStatus = typeof event.result === "string" && event.result === "fail" ? "fail" : "pass";
    }
  } else {
    nextStatus = "non-dg";
  }

  ctx.updateUld(event.uldId, (current) => ({
    ...current,
    dgStatus: nextStatus,
  }));
  ctx.setState({
    statusMessage:
      nextStatus === "non-dg"
        ? `${event.uldId} DG check complete: non-DG`
        : `${event.uldId} DG check complete: ${nextStatus}`,
  });
  ctx.addLog(`DG validation for ${event.uldId}: ${nextStatus}`, nextStatus === "fail" ? "warning" : "success");
}
