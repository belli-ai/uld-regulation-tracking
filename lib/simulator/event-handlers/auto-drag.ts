import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleAutoDrag(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const targetUldId =
    typeof event.uldId === "string"
      ? event.uldId
      : typeof event.into === "string"
        ? event.into
        : null;
  const awbs = Array.isArray(event.awbs)
    ? event.awbs.filter((awb): awb is string => typeof awb === "string")
    : [];

  if (!targetUldId || awbs.length === 0) {
    return;
  }

  const resolvedWaybills = awbs
    .map((awb) => ctx.getWaybill(awb))
    .filter((waybill): waybill is NonNullable<typeof waybill> => waybill !== null);
  const scenarioFlightNo = ctx.currentScenario.initial_state?.flights?.[0] ?? null;

  const next = ctx.updateUld(targetUldId, (uld) => ({
    ...uld,
    assignedAwbs: [...new Set([...uld.assignedAwbs, ...awbs])],
    flightNo:
      typeof event.flightNo === "string"
        ? event.flightNo
        : uld.flightNo ?? scenarioFlightNo,
    shc: [...new Set([...uld.shc, ...resolvedWaybills.map((waybill) => waybill.shc)])],
  }));

  if (next?.built) {
    ctx.syncBuiltUldToStore(next);
  }

  ctx.setState({
    selectedUldId: targetUldId,
    statusMessage: `${awbs.length} AWBs auto-dragged into ${targetUldId}`,
  });

  ctx.addLog(`Auto-dragged ${awbs.join(", ")} into ${targetUldId}`, "success");
}
