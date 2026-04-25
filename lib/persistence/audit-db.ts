import Dexie, { type Table } from 'dexie';

import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from '@/lib/ontology/one-record';

export class AuditDB extends Dexie {
  events!: Table<LogisticsEvent, string>;
  actions!: Table<LogisticsAction, string>;
  loadings!: Table<Loading, string>;

  constructor(databaseName = 'cool-chain-copilot-audit') {
    super(databaseName);

    this.version(1).stores({
      events: '@id, eventFor, eventDate, eventCode',
      actions: '@id, performedAt, actionStartTime, servedActivity',
      loadings: '@id, actionStartTime, *loadedUnits, *loadedPieces',
    });

    this.events = this.table('events');
    this.actions = this.table('actions');
    this.loadings = this.table('loadings');
  }
}

export function createAuditDb(databaseName?: string): AuditDB {
  return new AuditDB(databaseName);
}

export const auditDb = createAuditDb();
