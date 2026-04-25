import type { LogisticsEvent } from '@/lib/ontology/one-record';

export type RootCauseContext = {
  ambientTemperatureC?: number;
  executionLatencySec?: number;
  pcmPreconditioned?: boolean;
  predictedDelayMinutes?: number;
  state?: string;
  thermalBudgetRemainingPercent?: number;
};

export function infer(
  event: LogisticsEvent,
  context: RootCauseContext,
): string {
  if (context.pcmPreconditioned === false) {
    return 'pcm pre-conditioning failure';
  }

  if (
    typeof context.predictedDelayMinutes === 'number' &&
    context.predictedDelayMinutes >= 30
  ) {
    return 'flight delay';
  }

  if (
    typeof context.executionLatencySec === 'number' &&
    context.executionLatencySec >= 900
  ) {
    return 'late intervention';
  }

  if (
    typeof context.ambientTemperatureC === 'number' &&
    context.ambientTemperatureC >= 30
  ) {
    return 'tarmac exposure';
  }

  if (
    context.state?.includes('airside') ||
    context.state?.includes('ramp') ||
    context.state?.includes('loading')
  ) {
    return 'airside dwell';
  }

  if (
    typeof context.thermalBudgetRemainingPercent === 'number' &&
    context.thermalBudgetRemainingPercent <= 10
  ) {
    return 'low thermal autonomy';
  }

  if (event.eventCode === 'BREACH_ACTUAL') {
    return 'temperature control breakdown';
  }

  return 'multifactor exposure';
}

export const rootCauseInferrer = {
  infer,
};
