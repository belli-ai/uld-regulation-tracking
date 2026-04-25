import { resolutionLogger } from "@/lib/audit/resolution-logger";
import { toIRI } from "@/lib/ontology/one-record";
import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

export async function handleUldActionComplete(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  if (typeof event.uldId !== "string" || typeof event.action !== "string") {
    return;
  }

  const uld = ctx.getUld(event.uldId);
  if (!uld) {
    return;
  }

  if (event.action === "cool_dolly_retrieve") {
    ctx.stores.resources.getState().decrement("freeCoolDollies");
  }

  const measuredBenefitHours =
    typeof event.budget_recovery_h === "number" ? event.budget_recovery_h : 0;
  const excursionEventId =
    uld.lastExcursionEventId ??
    toIRI(`urn:cool-chain:event:manual:${uld.id}:${encodeURIComponent(ctx.nowIso())}`);

  const recordedAction = await resolutionLogger.record(
    {
      actionId: event.action,
      actionLabel:
        event.action === "cool_dolly_retrieve"
          ? "Retrieve cool dolly from Pool-North"
          : event.action.replaceAll("_", " "),
      claimedBenefitHours: measuredBenefitHours,
      excursionEventId,
      locationId: toIRI(uld.lastKnownLocation ?? "urn:cargo:zone:DXB-apron-staging-1"),
      measuredBenefitHours,
      outcome: "averted",
      startedAt: ctx.nowIso(),
      stationCapability:
        event.action === "cool_dolly_retrieve" ? "coolDolliesTotal" : undefined,
    },
    "demo-operator",
    90,
    ctx.auditDb,
  );

  ctx.updateUld(event.uldId, (current) => ({
    ...current,
    auditActionIds: [...current.auditActionIds, recordedAction["@id"]],
    budgetHours: Number((current.budgetHours + measuredBenefitHours).toFixed(1)),
    lastActionLabel: recordedAction.otherIdentifiers?.find((identifier) =>
      identifier.startsWith("actionLabel:"),
    ) ?? recordedAction["@id"],
    predictedBreachMinutes:
      current.predictedBreachMinutes === null
        ? null
        : current.predictedBreachMinutes + measuredBenefitHours * 60,
  }));

  ctx.setState({
    inAppAlert: {
      body: `${event.uldId} budget recovered by ${measuredBenefitHours}h`,
      title: "Mitigation completed",
      tone: "info",
    },
    statusMessage: `${event.action} completed for ${event.uldId}`,
  });
  ctx.addLog(`${event.action} completed for ${event.uldId}`, "success");
}
