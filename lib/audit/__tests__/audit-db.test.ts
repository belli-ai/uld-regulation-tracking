import { afterEach, describe, expect, it } from 'vitest';

import { excursionLogger } from '@/lib/audit/excursion-logger';
import { toIRI, type Loading } from '@/lib/ontology/one-record';
import { createAuditDb } from '@/lib/persistence/audit-db';

const threshold = {
  breachPredictionWindowMinutes: 60,
  maxInternalTemperatureC: 8,
  warningBudgetPercent: 30,
} as const;

async function deleteDb(name: string): Promise<void> {
  const database = createAuditDb(name);
  await database.delete();
}

afterEach(async () => {
  await deleteDb('audit-db-round-trip');
  await deleteDb('audit-db-reload');
});

describe('audit-db', () => {
  it('detect → write → read round trip preserves record identity and canonical shape', async () => {
    const database = createAuditDb('audit-db-round-trip');
    const event = excursionLogger.detect(
      {
        ambientTemperatureC: 36,
        internalTemperatureC: 6,
        locationId: toIRI('urn:location:dxb-ramp-a'),
        observedAt: '2026-04-25T09:15:00.000Z',
        predictedBreachInMinutes: 45,
        state: 'airside-loading',
        thermalBudgetRemainingPercent: 24,
        uldId: toIRI('urn:uld:AKE12345EK'),
      },
      threshold,
    );

    expect(event).not.toBeNull();

    await database.events.put(event!);

    const storedEvent = await database.events.get(event!['@id']);

    expect(storedEvent).toEqual(event);
    expect(storedEvent?.['@type']).toBe('LogisticsEvent');
  });

  it('data persists across simulated reload using a new Dexie instance', async () => {
    const databaseName = 'audit-db-reload';
    const firstInstance = createAuditDb(databaseName);
    const event = excursionLogger.detect(
      {
        ambientTemperatureC: 39,
        internalTemperatureC: 9.4,
        locationId: toIRI('urn:location:dxb-ramp-b'),
        observedAt: '2026-04-25T10:00:00.000Z',
        state: 'airside-loading',
        thermalBudgetRemainingPercent: 12,
        uldId: toIRI('urn:uld:AKE99887EK'),
      },
      threshold,
    );
    const loading: Loading = {
      '@id': toIRI('urn:loading:AKE99887EK:1'),
      '@type': 'Loading',
      actionStartTime: '2026-04-25T09:40:00.000Z',
      actionEndTime: '2026-04-25T09:50:00.000Z',
      performedAt: toIRI('urn:location:dxb-ramp-b'),
      servedActivity: toIRI('urn:movement:EK761'),
      loadedPieces: [toIRI('urn:piece:1')],
      loadedUnits: [toIRI('urn:uld:AKE99887EK')],
      loadingType: 'aircraft-main-deck',
    };

    expect(event).not.toBeNull();

    await firstInstance.events.put(event!);
    await firstInstance.loadings.put(loading);
    firstInstance.close();

    const secondInstance = createAuditDb(databaseName);
    const storedEvent = await secondInstance.events.get(event!['@id']);
    const storedLoading = await secondInstance.loadings.get(loading['@id']);

    expect(storedEvent).toEqual(event);
    expect(storedLoading).toEqual(loading);
  });
});
