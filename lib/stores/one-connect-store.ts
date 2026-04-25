import { create } from "zustand";
import type { Measurement } from "@/lib/ontology/one-record";

export type ServerInfo = {
  enabled: boolean;
  ontology: string[];
  hasDataHolder: string | null;
  lastModified: string | null;
};

export type SubscriptionStatus = {
  created: string[];
  skipped: string[];
  failed: string[];
};

type OneConnectStore = {
  serverInfo: ServerInfo | null;
  subscriptionStatus: SubscriptionStatus | null;
  lastMeasurementByUld: Record<string, Measurement>;
  setServerInfo: (serverInfo: ServerInfo | null) => void;
  setSubscriptionStatus: (subscriptionStatus: SubscriptionStatus | null) => void;
  recordMeasurement: (uldIri: string, measurement: Measurement) => void;
};

export const useOneConnectStore = create<OneConnectStore>()((set) => ({
  serverInfo: null,
  subscriptionStatus: null,
  lastMeasurementByUld: {},
  setServerInfo: (serverInfo) => set({ serverInfo }),
  setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
  recordMeasurement: (uldIri, measurement) =>
    set((state) => ({
      lastMeasurementByUld: {
        ...state.lastMeasurementByUld,
        [uldIri]: measurement,
      },
    })),
}));
