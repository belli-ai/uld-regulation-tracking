import { toIRI, type LogisticsEvent } from "@/lib/ontology/one-record";
import {
  createLoadingRecord,
  type RunnerContext,
} from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleBuildUpSignoff(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  if (typeof event.uldId !== "string") {
    return;
  }

  const observedAt = ctx.nowIso();
  const signedUld = ctx.updateUld(event.uldId, (uld) => ({
    ...uld,
    built: true,
    budgetHours: 11.2,
    flightNo:
      uld.flightNo ?? ctx.currentScenario.initial_state?.flights?.[0] ?? null,
    lastKnownLocation: "urn:cargo:zone:DXB-build-up-area",
    sealNumber: uld.sealNumber ?? "EK-S-991023",
    state: "in-warehouse",
    trackerStreaming: true,
  }));

  if (!signedUld) {
    return;
  }

  const loading = createLoadingRecord(signedUld, observedAt);
  const buildCompleteEvent: LogisticsEvent = {
    "@id": toIRI(
      `urn:cool-chain:event:BUILD_UP_COMPLETE:${signedUld.id}:${encodeURIComponent(observedAt)}`,
    ),
    "@type": "LogisticsEvent",
    eventCode: "BUILD_UP_COMPLETE",
    eventDate: observedAt,
    eventFor: signedUld.iri,
    eventLocation: toIRI("urn:cargo:zone:DXB-build-up-area"),
    eventName: "Build-up completed",
    eventTimeType: "actual",
  };

  await ctx.auditDb.loadings.put(loading, loading["@id"]);
  await ctx.auditDb.events.put(buildCompleteEvent, buildCompleteEvent["@id"]);
  ctx.syncBuiltUldToStore(signedUld);

  ctx.updateUld(event.uldId, (uld) => ({
    ...uld,
    auditEventIds: [...uld.auditEventIds, buildCompleteEvent["@id"]],
  }));

  ctx.setState({
    selectedFlightNo: signedUld.flightNo,
    selectedUldId: signedUld.id,
    statusMessage: `${signedUld.id} build-up signed off`,
  });
  ctx.addLog(`Build-up signed off for ${signedUld.id}`, "success");
}
