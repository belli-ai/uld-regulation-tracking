import Dexie, { type Table } from "dexie";

import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from "@/lib/ontology/one-record";

export class AuditDB extends Dexie {
  events!: Table<LogisticsEvent, string>;
  actions!: Table<LogisticsAction, string>;
  loadings!: Table<Loading, string>;

  constructor(databaseName = "cool-chain-copilot-audit") {
    super(databaseName);

    this.version(2).stores({
      events: ", eventFor, eventDate, eventCode",
      actions: ", performedAt, actionStartTime, servedActivity",
      loadings: ", actionStartTime, *loadedUnits, *loadedPieces",
    });

    this.events = this.table("events");
    this.actions = this.table("actions");
    this.loadings = this.table("loadings");
  }
}

export function createAuditDb(databaseName?: string): AuditDB {
  return new AuditDB(databaseName);
}

export const auditDb = createAuditDb();
