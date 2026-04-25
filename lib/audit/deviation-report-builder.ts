import type { IRI, Loading, LogisticsAction, LogisticsEvent } from '@/lib/ontology/one-record';
import { auditDb, type AuditDB } from '@/lib/persistence/audit-db';

import { infer } from './root-cause-inferrer';

type ReportContext = {
  ambientTemperatureC?: number;
  executionLatencySec?: number;
  pcmPreconditioned?: boolean;
  predictedDelayMinutes?: number;
  state?: string;
  thermalBudgetRemainingPercent?: number;
};

type BuildOptions = {
  context?: ReportContext;
  database?: AuditDB;
};

function isExcursionEvent(event: LogisticsEvent): boolean {
  return (
    event.eventCode === 'WARNING_BUDGET_LOW' ||
    event.eventCode === 'BREACH_PREDICTED' ||
    event.eventCode === 'BREACH_ACTUAL'
  );
}

function summarizeEvent(event: LogisticsEvent): string {
  return `- ${event.eventDate} · ${event.eventCode} · ${event.eventName}`;
}

function summarizeAction(action: LogisticsAction): string {
  const identifiers = action.otherIdentifiers ?? [];
  const actionLabel =
    identifiers.find((identifier) => identifier.startsWith('actionLabel:')) ??
    'actionLabel:Unspecified response';
  const outcome =
    identifiers.find((identifier) => identifier.startsWith('outcome:')) ??
    'outcome:monitoring';

  return `- ${action.actionStartTime} → ${action.actionEndTime ?? 'open'} · ${actionLabel.replace(
    'actionLabel:',
    '',
  )} · ${outcome.replace('outcome:', '')}`;
}

function summarizeLoading(loading: Loading): string {
  return `- ${loading.actionStartTime} · loadingType:${loading.loadingType} · loadedUnits:${loading.loadedUnits.length}`;
}

function buildRecommendations(rootCause: string, actions: LogisticsAction[]): string[] {
  if (rootCause === 'tarmac exposure' || rootCause === 'airside dwell') {
    return [
      '- Keep the ULD in a cool-room buffer until final ramp release.',
      '- Recheck predicted dwell time before the next handoff.',
    ];
  }

  if (rootCause === 'flight delay') {
    return [
      '- Re-run the delay forecast before pushback decisions.',
      '- Escalate to a higher-benefit mitigation if the delay exceeds 30 minutes.',
    ];
  }

  if (rootCause === 'pcm pre-conditioning failure') {
    return [
      '- Verify PCM conditioning status before loading release.',
      '- Block dispatch when pre-conditioning evidence is missing.',
    ];
  }

  if (actions.length === 0) {
    return [
      '- Define a first-response action playbook for this SHC profile.',
      '- Add supervisor review for unresolved excursions.',
    ];
  }

  return [
    '- Keep monitoring the ULD until the next stable checkpoint.',
    '- Compare claimed versus measured benefit to recalibrate the action ranker.',
  ];
}

export async function buildMarkdown(
  uldId: IRI | string,
  options: BuildOptions = {},
): Promise<string> {
  const database = options.database ?? auditDb;
  const uldIri = String(uldId);
  const events = (await database.events.toArray())
    .filter((event) => String(event.eventFor) === uldIri)
    .filter(isExcursionEvent)
    .sort((left, right) => left.eventDate.localeCompare(right.eventDate));
  const actions = (await database.actions.toArray())
    .filter((action) =>
      events.some((event) => action.servedActivity === event['@id']),
    )
    .sort((left, right) => left.actionStartTime.localeCompare(right.actionStartTime));
  const loadings = (await database.loadings.toArray())
    .filter((loading) =>
      loading.loadedUnits.some((loadedUnit) => String(loadedUnit) === uldIri),
    )
    .sort((left, right) => left.actionStartTime.localeCompare(right.actionStartTime));
  const primaryEvent = events.at(-1);
  const rootCause = primaryEvent
    ? infer(primaryEvent, options.context ?? {})
    : 'no deviation recorded';
  const recommendations = buildRecommendations(rootCause, actions);

  const headerLines = [
    '# Deviation Report',
    '',
    `ULD: ${uldIri}`,
    `Generated: ${new Date().toISOString()}`,
  ];
  const deviationSummaryLines = [
    '## Deviation Summary',
    '',
    ...(events.length > 0
      ? events.map(summarizeEvent)
      : ['- No excursion events found for this ULD.']),
    ...(loadings.length > 0 ? ['', 'Loading context:'] : []),
    ...loadings.map(summarizeLoading),
  ];
  const rootCauseLines = [
    '## Root Cause',
    '',
    primaryEvent
      ? `Primary root cause: ${rootCause}`
      : 'Primary root cause: no deviation recorded',
  ];
  const actionLines = [
    '## Actions Taken',
    '',
    ...(actions.length > 0
      ? actions.map(summarizeAction)
      : ['- No resolution actions recorded.']),
  ];
  const recommendationLines = [
    '## Recommendations',
    '',
    ...recommendations,
  ];

  return [
    ...headerLines,
    '',
    ...deviationSummaryLines,
    '',
    ...rootCauseLines,
    '',
    ...actionLines,
    '',
    ...recommendationLines,
  ].join('\n');
}

export const deviationReportBuilder = {
  buildMarkdown,
};
