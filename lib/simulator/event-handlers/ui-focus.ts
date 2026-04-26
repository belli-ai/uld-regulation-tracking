import type {
  DemoFocusTarget,
  RunnerContext,
} from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

function routeForFocus(
  target: DemoFocusTarget,
  flightNo: string | null,
  uldId: string | null,
): string {
  const flightSegment = flightNo ? encodeURIComponent(flightNo) : null;
  const uldSegment = uldId ? encodeURIComponent(uldId) : null;

  switch (target) {
    case "flight_list":
      return "/";
    case "flight_workspace":
      return flightSegment ? `/flight/${flightSegment}` : "/flight/[flightNo]";
    case "build_up_canvas":
      return flightSegment && uldSegment
        ? `/flight/${flightSegment}/build/${uldSegment}`
        : "/flight/[flightNo]/build/[uldId]";
    case "uld_detail":
      return uldSegment ? `/uld/${uldSegment}` : "/uld/[uldId]";
    case "supervisor_dashboard":
      return "/supervisor";
    case "audit_log":
      return uldSegment
        ? `/supervisor/audit/${uldSegment}`
        : "/supervisor/audit/[uldId]";
    case "pitch_slide":
      return "/pitch";
  }
}

export async function handleUiFocus(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const target =
    event.target === "flight_list" ||
    event.target === "flight_workspace" ||
    event.target === "build_up_canvas" ||
    event.target === "uld_detail" ||
    event.target === "supervisor_dashboard" ||
    event.target === "audit_log" ||
    event.target === "pitch_slide"
      ? event.target
      : null;

  if (!target) {
    return;
  }

  const selectedFlightNo =
    typeof event.flightNo === "string"
      ? event.flightNo
      : ctx.getState().selectedFlightNo;
  const selectedUldId =
    typeof event.uldId === "string"
      ? event.uldId
      : ctx.getState().selectedUldId;

  ctx.setState({
    selectedFlightNo,
    selectedUldId,
    statusMessage: `UI focus moved to ${target}`,
    uiFocus: target,
    uiRoute: routeForFocus(target, selectedFlightNo, selectedUldId),
  });
  ctx.addLog(`Focused ${target}`, "info");
}
