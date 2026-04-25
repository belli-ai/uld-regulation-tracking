import { applyScenarioEvent } from "@/lib/inference/state-classifier";
import { toIRI, type LogisticsEvent } from "@/lib/ontology/one-record";
import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

const LOCATION_BY_STATE: Record<
  "in-warehouse" | "in-tarmac" | "in-flight" | "arrived-tarmac" | "arrived-destination",
  string
> = {
  "arrived-destination": "urn:cargo:zone:DEST-warehouse",
  "arrived-tarmac": "urn:cargo:zone:DEST-tarmac",
  "in-flight": "urn:cargo:zone:airspace",
  "in-tarmac": "urn:cargo:zone:DXB-apron-staging-1",
  "in-warehouse": "urn:cargo:zone:DXB-cool-room",
};

export async function handleUldStateForce(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const forcedState =
    event.state === "in-warehouse" ||
    event.state === "in-tarmac" ||
    event.state === "in-flight" ||
    event.state === "arrived-tarmac" ||
    event.state === "arrived-destination"
      ? event.state
      : null;

  if (
    typeof event.uldId !== "string" ||
    forcedState === null
  ) {
    return;
  }

  applyScenarioEvent({
    state: forcedState,
    type: "uld_state_force",
    uldId: event.uldId,
  });

  const next = ctx.updateUld(event.uldId, (uld) => ({
    ...uld,
    lastKnownLocation: LOCATION_BY_STATE[forcedState],
    state: forcedState,
  }));

  if (!next) {
    return;
  }

  const stateEvent: LogisticsEvent = {
    "@id": toIRI(
      `urn:cool-chain:event:STATE_FORCE:${next.id}:${encodeURIComponent(ctx.nowIso())}`,
    ),
    "@type": "LogisticsEvent",
    eventCode: `STATE_FORCE_${forcedState.toUpperCase().replaceAll("-", "_")}`,
    eventDate: ctx.nowIso(),
    eventFor: next.iri,
    eventLocation: toIRI(LOCATION_BY_STATE[forcedState]),
    eventName: `ULD forced to ${forcedState}`,
    eventTimeType: "actual",
  };

  await ctx.auditDb.events.put(stateEvent);
  ctx.updateUld(event.uldId, (uld) => ({
    ...uld,
    auditEventIds: [...uld.auditEventIds, stateEvent["@id"]],
  }));
  ctx.addLog(`Forced ${event.uldId} to ${forcedState}`, "info");
}
