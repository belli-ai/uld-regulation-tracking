import type { LogisticsAction } from "@/lib/ontology/one-record";
import { toIRI } from "@/lib/ontology/one-record";
import {
  ACTION_LIBRARY,
  type Action,
} from "@/lib/recommender/action-library";
import {
  filterActions,
  type Resources,
  type StationCapabilities,
  type UldContext,
} from "@/lib/recommender/filters";

const COST_WEIGHTS: Record<Action["costTier"], number> = {
  none: 1,
  low: 2,
  medium: 4,
  high: 8,
};

const DISRUPTION_WEIGHTS: Record<Action["authority"], number> = {
  handler: 1,
  supervisor: 1.5,
  "ops-control": 2,
};

export type RankedAction = Action & {
  score: number;
  rank: number;
  materialiseAsLogisticsAction: (
    uldId: string,
    startTime: Date,
  ) => LogisticsAction;
};

function averageBenefitMinutes(action: Action): number {
  const [minHours, maxHours] = action.benefitHours;
  return ((minHours + maxHours) / 2) * 60;
}

function buildRankedAction(action: Action, score: number): RankedAction {
  return {
    ...action,
    score,
    rank: 0,
    materialiseAsLogisticsAction(uldId: string, startTime: Date): LogisticsAction {
      const endTime = new Date(startTime.getTime() + action.executionMinutes * 60_000);
      const logisticsAction = {
        "@id": toIRI(
          `urn:coolchain:action:${action.id}:${uldId}:${startTime.getTime()}`,
        ),
        "@type": "LogisticsAction",
        actionStartTime: startTime.toISOString(),
        actionEndTime: endTime.toISOString(),
        performedAt: toIRI(uldId),
        description: action.label,
      } satisfies LogisticsAction & { description: string };

      return logisticsAction;
    },
  };
}

function scoreAction(action: Action, timeToBreach: number): number {
  if (action.id === "DOC-001") {
    return 0;
  }

  const thermalBenefit = averageBenefitMinutes(action);
  const cost = COST_WEIGHTS[action.costTier];
  const disruption = DISRUPTION_WEIGHTS[action.authority];

  return (
    (thermalBenefit * timeToBreach) /
    (cost * action.executionMinutes * disruption)
  );
}

export function recommendActions(
  ctx: UldContext,
  station: StationCapabilities,
  resources: Resources,
): RankedAction[] {
  const viable = filterActions(ACTION_LIBRARY, ctx, station, resources);
  const fallback = ACTION_LIBRARY.find((action) => action.id === "DOC-001");

  const viableWithFallback =
    fallback !== undefined && !viable.some((action) => action.id === fallback.id)
      ? [...viable, fallback]
      : viable;

  return viableWithFallback
    .map((action) => buildRankedAction(action, scoreAction(action, ctx.timeToBreach)))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((action, index) => ({
      ...action,
      rank: index + 1,
    }));
}
