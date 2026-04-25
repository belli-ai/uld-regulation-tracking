import Dexie, { type Table } from "dexie";

import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from "@/lib/ontology/one-record";

export type UldThermalSnapshot = {
  uldId: string;
  flightNumber: string | null;
  stage:
    | "in-warehouse"
    | "in-tarmac"
    | "in-flight"
    | "arrived-tarmac"
    | "arrived-destination";
  isPassive: boolean;
  internalC: number;
  ambientC: number;
  effectiveAmbientC: number;
  budgetH: number;
  budgetPercent: number;
  budgetTone: "green" | "yellow" | "red";
  breachAtMs: number | null;
  predictedBreachMinutes: number | null;
  shcCode: string;
  uldProductCode: string | null;
  updatedMs: number;
};

export class AuditDB extends Dexie {
  events!: Table<LogisticsEvent, string>;
  actions!: Table<LogisticsAction, string>;
  loadings!: Table<Loading, string>;
  uldStatus!: Table<UldThermalSnapshot, string>;

  constructor(databaseName = "cool-chain-copilot-audit") {
    super(databaseName);

    this.version(2).stores({
      events: ", eventFor, eventDate, eventCode",
      actions: ", performedAt, actionStartTime, servedActivity",
      loadings: ", actionStartTime, *loadedUnits, *loadedPieces",
    });

    this.version(3).stores({
      events: ", eventFor, eventDate, eventCode",
      actions: ", performedAt, actionStartTime, servedActivity",
      loadings: ", actionStartTime, *loadedUnits, *loadedPieces",
      uldStatus: "uldId, stage, budgetTone, updatedMs",
    });

    this.events = this.table("events");
    this.actions = this.table("actions");
    this.loadings = this.table("loadings");
    this.uldStatus = this.table("uldStatus");
  }
}

export function createAuditDb(databaseName?: string): AuditDB {
  return new AuditDB(databaseName);
}

export const auditDb = createAuditDb();
