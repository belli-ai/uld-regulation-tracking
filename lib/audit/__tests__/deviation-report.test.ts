import { afterEach, describe, expect, it } from 'vitest';

import { deviationReportBuilder } from '@/lib/audit/deviation-report-builder';
import { excursionLogger } from '@/lib/audit/excursion-logger';
import { resolutionLogger } from '@/lib/audit/resolution-logger';
import { toIRI, type Loading } from '@/lib/ontology/one-record';
import { createAuditDb } from '@/lib/persistence/audit-db';

async function deleteDb(name: string): Promise<void> {
  const database = createAuditDb(name);
  await database.delete();
}

afterEach(async () => {
  await deleteDb('audit-db-report');
});

describe('deviation-report-builder', () => {
  it('includes header, deviation summary, root cause, actions, and recommendations sections', async () => {
    const database = createAuditDb('audit-db-report');
    const event = excursionLogger.detect(
      {
        ambientTemperatureC: 38,
        internalTemperatureC: 9.1,
        locationId: toIRI('urn:location:dxb-ramp-c'),
        observedAt: '2026-04-25T11:00:00.000Z',
        predictedBreachInMinutes: 10,
        state: 'airside-loading',
        thermalBudgetRemainingPercent: 8,
        uldId: toIRI('urn:uld:AKE55555EK'),
      },
      {
        breachPredictionWindowMinutes: 60,
        maxInternalTemperatureC: 8,
        warningBudgetPercent: 30,
      },
    );
    const loading: Loading = {
      '@id': toIRI('urn:loading:AKE55555EK:1'),
      '@type': 'Loading',
      actionStartTime: '2026-04-25T10:15:00.000Z',
      actionEndTime: '2026-04-25T10:35:00.000Z',
      performedAt: toIRI('urn:location:dxb-ramp-c'),
      servedActivity: toIRI('urn:movement:EK763'),
      loadedPieces: [toIRI('urn:piece:99')],
      loadedUnits: [toIRI('urn:uld:AKE55555EK')],
      loadingType: 'aircraft-lower-deck',
    };

    expect(event).not.toBeNull();

    await database.events.put(event!);
    await database.loadings.put(loading);
    await resolutionLogger.record(
      {
        actionId: 'move-to-shade',
        actionLabel: 'Move to shade',
        excursionEventId: event!['@id'],
        locationId: toIRI('urn:location:dxb-ramp-c'),
        outcome: 'monitoring',
        startedAt: '2026-04-25T11:05:00.000Z',
      },
      'supervisor',
      180,
      database,
    );

    const markdown = await deviationReportBuilder.buildMarkdown(
      toIRI('urn:uld:AKE55555EK'),
      {
        context: {
          ambientTemperatureC: 38,
          state: 'airside-loading',
          thermalBudgetRemainingPercent: 8,
        },
        database,
      },
    );

    expect(markdown).toContain('# Deviation Report');
    expect(markdown).toContain('## Deviation Summary');
    expect(markdown).toContain('## Root Cause');
    expect(markdown).toContain('## Actions Taken');
    expect(markdown).toContain('## Recommendations');
  });
});
