import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { ULD } from "@/lib/ontology/one-record";

export type InventoryUld = ULD & {
  buildUpStatus?: "available" | "in-build-up";
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
  uldProductCode?: string;
};

type InventoryStore = {
  inventory: InventoryUld[];
  hydrateInventory: (inventory: ULD[]) => void;
  markInBuildUp: (id: string) => void;
  releaseFromBuildUp: (id: string) => void;
};

const memoryStorageState: Record<string, string> = {};

const memoryStorage: StateStorage = {
  getItem: (name) => memoryStorageState[name] ?? null,
  setItem: (name, value) => {
    memoryStorageState[name] = value;
  },
  removeItem: (name) => {
    delete memoryStorageState[name];
  },
};

function getSessionStorage(): StateStorage {
  if (typeof window === "undefined") {
    return memoryStorage;
  }

  try {
    const { sessionStorage } = window;
    const probeKey = "__inventory-store__";
    sessionStorage.setItem(probeKey, probeKey);
    sessionStorage.removeItem(probeKey);
    return sessionStorage;
  } catch (error) {
    console.warn(
      "inventory-store: sessionStorage unavailable, using in-memory fallback",
      error,
    );
    return memoryStorage;
  }
}

function mergeInventory(
  nextInventory: ULD[],
  currentInventory: InventoryUld[],
): InventoryUld[] {
  const currentById = new Map(
    currentInventory.map((uld) => [uld["@id"], uld.buildUpStatus]),
  );

  return nextInventory.map((uld) => ({
    ...uld,
    buildUpStatus: currentById.get(uld["@id"]) ?? "available",
  }));
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      inventory: [],
      hydrateInventory: (inventory) =>
        set((state) => ({
          inventory: mergeInventory(inventory, state.inventory),
        })),
      markInBuildUp: (id) =>
        set((state) => ({
          inventory: state.inventory.map((uld) =>
            uld["@id"] === id
              ? {
                  ...uld,
                  buildUpStatus: "in-build-up",
                }
              : uld,
          ),
        })),
      releaseFromBuildUp: (id) =>
        set((state) => ({
          inventory: state.inventory.map((uld) =>
            uld["@id"] === id
              ? {
                  ...uld,
                  buildUpStatus: "available",
                }
              : uld,
          ),
        })),
    }),
    {
      name: "inventory-store",
      storage: createJSONStorage(getSessionStorage),
      partialize: (state) => ({
        inventory: state.inventory,
      }),
    },
  ),
);
