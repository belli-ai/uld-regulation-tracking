import type { IRI, LogisticsEvent } from '@/lib/ontology/one-record';
import { toIRI } from '@/lib/ontology/one-record';

export type ExcursionEventCode =
  | 'WARNING_BUDGET_LOW'
  | 'BREACH_PREDICTED'
  | 'BREACH_ACTUAL';

export type UldContext = {
  ambientTemperatureC: number;
  flightId?: IRI;
  internalTemperatureC: number;
  locationId: IRI;
  observedAt: string;
  predictedBreachInMinutes?: number | null;
  recordingActor?: IRI;
  recordingOrganization?: IRI;
  state: string;
  thermalBudgetRemainingPercent: number;
  uldId: IRI;
};

export type ExcursionThreshold = {
  breachPredictionWindowMinutes: number;
  maxInternalTemperatureC: number;
  warningBudgetPercent: number;
};

function detectEventCode(
  uldContext: UldContext,
  threshold: ExcursionThreshold,
): ExcursionEventCode | null {
  if (uldContext.internalTemperatureC > threshold.maxInternalTemperatureC) {
    return 'BREACH_ACTUAL';
  }

  if (
    typeof uldContext.predictedBreachInMinutes === 'number' &&
    uldContext.predictedBreachInMinutes <= threshold.breachPredictionWindowMinutes
  ) {
    return 'BREACH_PREDICTED';
  }

  if (
    uldContext.thermalBudgetRemainingPercent <= threshold.warningBudgetPercent
  ) {
    return 'WARNING_BUDGET_LOW';
  }

  return null;
}

function createEventId(
  eventCode: ExcursionEventCode,
  observedAt: string,
  uldId: IRI,
): IRI {
  return toIRI(
    `urn:cool-chain:event:${eventCode}:${encodeURIComponent(
      observedAt,
    )}:${encodeURIComponent(uldId)}`,
  );
}

function createEventName(eventCode: ExcursionEventCode): string {
  switch (eventCode) {
    case 'WARNING_BUDGET_LOW':
      return 'Thermal budget low';
    case 'BREACH_PREDICTED':
      return 'Thermal breach predicted';
    case 'BREACH_ACTUAL':
      return 'Thermal breach actual';
  }
}

export function detect(
  uldContext: UldContext,
  threshold: ExcursionThreshold,
): LogisticsEvent | null {
  const eventCode = detectEventCode(uldContext, threshold);

  if (!eventCode) {
    return null;
  }

  return {
    '@id': createEventId(eventCode, uldContext.observedAt, uldContext.uldId),
    '@type': 'LogisticsEvent',
    eventCode,
    eventName: createEventName(eventCode),
    eventDate: uldContext.observedAt,
    eventFor: uldContext.uldId,
    eventLocation: uldContext.locationId,
    eventTimeType: 'actual',
    recordingActor: uldContext.recordingActor,
    recordingOrganization: uldContext.recordingOrganization,
  };
}

export const excursionLogger = {
  detect,
};
