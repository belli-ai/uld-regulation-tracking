import { addSeconds } from 'date-fns';

import type { IRI, LogisticsAction } from '@/lib/ontology/one-record';
import { toIRI } from '@/lib/ontology/one-record';
import { auditDb, type AuditDB } from '@/lib/persistence/audit-db';

export type ResolutionOutcome =
  | 'averted'
  | 'breached-anyway'
  | 'monitoring'
  | 'cancelled';

export type RankedAction = {
  actionId: string;
  actionLabel: string;
  claimedBenefitHours?: number;
  excursionEventId: IRI;
  locationId: IRI;
  measuredBenefitHours?: number;
  outcome?: ResolutionOutcome;
  startedAt: string;
  stationCapability?: string;
};

function createActionId(actionId: string, startedAt: string): IRI {
  return toIRI(
    `urn:cool-chain:action:${encodeURIComponent(actionId)}:${encodeURIComponent(
      startedAt,
    )}`,
  );
}

function buildOtherIdentifiers(
  rankedAction: RankedAction,
  executor: string,
  executionTimeSec: number,
): string[] {
  const identifiers = [
    `actionRef:${rankedAction.actionId}`,
    `actionLabel:${rankedAction.actionLabel}`,
    `executor:${executor}`,
    `executionTimeSec:${executionTimeSec}`,
  ];

  if (typeof rankedAction.claimedBenefitHours === 'number') {
    identifiers.push(`claimedBenefitHours:${rankedAction.claimedBenefitHours}`);
  }

  if (typeof rankedAction.measuredBenefitHours === 'number') {
    identifiers.push(`measuredBenefitHours:${rankedAction.measuredBenefitHours}`);
  }

  if (rankedAction.outcome) {
    identifiers.push(`outcome:${rankedAction.outcome}`);
  }

  if (rankedAction.stationCapability) {
    identifiers.push(`stationCapability:${rankedAction.stationCapability}`);
  }

  return identifiers;
}

export async function record(
  rankedAction: RankedAction,
  executor: string,
  executionTimeSec: number,
  database: AuditDB = auditDb,
): Promise<LogisticsAction> {
  const action: LogisticsAction = {
    '@id': createActionId(rankedAction.actionId, rankedAction.startedAt),
    '@type': 'LogisticsAction',
    actionStartTime: rankedAction.startedAt,
    actionEndTime: addSeconds(
      new Date(rankedAction.startedAt),
      executionTimeSec,
    ).toISOString(),
    performedAt: rankedAction.locationId,
    servedActivity: rankedAction.excursionEventId,
    otherIdentifiers: buildOtherIdentifiers(
      rankedAction,
      executor,
      executionTimeSec,
    ),
  };

  await database.actions.put(action);

  return action;
}

export const resolutionLogger = {
  record,
};
