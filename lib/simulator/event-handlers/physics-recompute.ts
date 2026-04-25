import uldSpecsSource from "@/public/config/uld-specs.json";
import { integrateBudget } from "@/lib/physics/pcm-model";
import { toIRI, type Measurement } from "@/lib/ontology/one-record";
import type { UldPhysicsSpec } from "@/lib/physics/uld-specs-loader";
import {
  type DemoActionCard,
  buildExcursionEventForUld,
  buildTemperatureInstructionForAwbs,
  getStationCapabilities,
  type RunnerContext,
} from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

function buildAmbientCurve(nowIso: string, ambientC: number): Measurement[] {
  const startMs = Date.parse(nowIso);
  return Array.from({ length: 13 }, (_, index) => ({
    "@id": toIRI(`urn:cool-chain:ambient:${startMs}:${index}`),
    "@type": "Measurement" as const,
    bySensor: toIRI("urn:cargo:sensor:ambient-sim"),
    measurementTimestamp: new Date(startMs + index * 60 * 60 * 1000).toISOString(),
    measurementValue: {
      unit: "C",
      value: ambientC + Math.min(index * 0.2, 1.5),
    },
  }));
}

function resolveUldSpec(productCode: string): UldPhysicsSpec {
  const raw = (uldSpecsSource as Record<string, unknown>)[productCode] as
    | {
        heatTransferCoefficient?: number;
        pcmMeltRangeC?: { min?: number; max?: number } | null;
        ratedAutonomyHoursAt25C?: number;
      }
    | undefined;

  return {
    autonomyHours: raw?.ratedAutonomyHoursAt25C ?? 24,
    id: productCode,
    pcmHeatOfFusionKJ_kg: productCode.includes("GENERIC") ? 0 : 334,
    pcmMassKg: productCode.includes("GENERIC") ? 0 : 60,
    pcmMeltEnd: raw?.pcmMeltRangeC?.max ?? 999,
    pcmMeltStart: raw?.pcmMeltRangeC?.min ?? 999,
    surfaceAreaM2: productCode.startsWith("AKH") ? 12 : 8,
    thermalMassKJ_K: productCode.startsWith("AKH") ? 20 : 35,
    uValueW_m2K: raw?.heatTransferCoefficient ?? 0.5,
  };
}

function curatedActionCards(uldId: string, freeCoolDollies: number): DemoActionCard[] {
  return [
    {
      authorityLabel: "no approval",
      benefitHours: 3.5,
      ctaLabel: "EXECUTE",
      etaMinutes: 4,
      expectedActionToken: "execute_action_1",
      title: "Park in jet-bridge shadow",
      tone: "positive",
    },
    {
      authorityLabel: `${freeCoolDollies} dollies free`,
      benefitHours: 5,
      ctaLabel: "EXECUTE",
      etaMinutes: 12,
      expectedActionToken: "execute_action_2",
      resourceHint: "cool dolly pool north",
      title: "Retrieve cool dolly from Pool-North",
      tone: "warning",
    },
    {
      authorityLabel: "needs loadmaster",
      benefitHours: 2,
      ctaLabel: "ESCALATE",
      etaMinutes: 6,
      expectedActionToken: "execute_action_3",
      title: "Push priority loading slot 7→2",
      tone: "destructive",
    },
  ];
}

export async function handlePhysicsRecompute(
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

  const ambientCurve = buildAmbientCurve(
    ctx.nowIso(),
    ctx.getState().weather.ambientC + (uld.state === "in-tarmac" ? 1.5 : -4),
  );
  const spec = resolveUldSpec(uld.productCode);
  const threshold = buildTemperatureInstructionForAwbs(uld.assignedAwbs);
  const integration = integrateBudget(
    spec,
    uld.internalTemperatureC,
    ambientCurve,
    60,
    threshold,
  );
  const computedBudgetHours = Number((integration.budgetSec / 3600).toFixed(1));
  const predictedBreachMinutes = Number((integration.budgetSec / 60).toFixed(0));
  const freeCoolDollies = ctx.stores.resources.getState().freeCoolDollies;
  const actionCards = curatedActionCards(uld.id, freeCoolDollies);

  const next = ctx.updateUld(event.uldId, (current) => ({
    ...current,
    actionCards,
    budgetHours:
      current.state === "in-tarmac" ? Math.min(computedBudgetHours, 4) : computedBudgetHours,
    predictedBreachMinutes:
      current.state === "in-tarmac" ? Math.min(predictedBreachMinutes, 38) : predictedBreachMinutes,
  }));

  if (!next) {
    return;
  }

  const excursionEvent = buildExcursionEventForUld(next, ctx.nowIso());
  if (excursionEvent) {
    await ctx.auditDb.events.put(excursionEvent);
    ctx.updateUld(event.uldId, (current) => ({
      ...current,
      auditEventIds: [...current.auditEventIds, excursionEvent["@id"]],
      lastExcursionEventId: excursionEvent["@id"],
    }));
  }

  ctx.setState({
    statusMessage: `${event.uldId} physics recomputed`,
  });
  ctx.addLog(`Physics recomputed for ${event.uldId}`, "warning");
  void getStationCapabilities();
}
