"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

export type DemoResource =
  | "freeCoolDollies"
  | "freeBuildupBays"
  | "freeCoolRoomSlots";

type ResourcesState = {
  freeCoolDollies: number;
  freeBuildupBays: number;
  freeCoolRoomSlots: number;
  decrement: (resource: DemoResource) => void;
  increment: (resource: DemoResource) => void;
  setResources: (resources: Partial<Pick<ResourcesState, DemoResource>>) => void;
  resetResources: () => void;
};

const DEFAULT_RESOURCES: Pick<ResourcesState, DemoResource> = {
  freeCoolDollies: 0,
  freeBuildupBays: 0,
  freeCoolRoomSlots: 0,
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function adjustResource(
  state: ResourcesState,
  resource: DemoResource,
  delta: number,
): Pick<ResourcesState, DemoResource> {
  return {
    ...DEFAULT_RESOURCES,
    freeCoolDollies:
      resource === "freeCoolDollies"
        ? Math.max(0, state.freeCoolDollies + delta)
        : state.freeCoolDollies,
    freeBuildupBays:
      resource === "freeBuildupBays"
        ? Math.max(0, state.freeBuildupBays + delta)
        : state.freeBuildupBays,
    freeCoolRoomSlots:
      resource === "freeCoolRoomSlots"
        ? Math.max(0, state.freeCoolRoomSlots + delta)
        : state.freeCoolRoomSlots,
  };
}

export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set) => ({
      ...DEFAULT_RESOURCES,
      decrement: (resource) =>
        set((state) => adjustResource(state, resource, -1)),
      increment: (resource) =>
        set((state) => adjustResource(state, resource, 1)),
      setResources: (resources) =>
        set((state) => ({
          freeCoolDollies:
            typeof resources.freeCoolDollies === "number"
              ? Math.max(0, Math.floor(resources.freeCoolDollies))
              : state.freeCoolDollies,
          freeBuildupBays:
            typeof resources.freeBuildupBays === "number"
              ? Math.max(0, Math.floor(resources.freeBuildupBays))
              : state.freeBuildupBays,
          freeCoolRoomSlots:
            typeof resources.freeCoolRoomSlots === "number"
              ? Math.max(0, Math.floor(resources.freeCoolRoomSlots))
              : state.freeCoolRoomSlots,
        })),
      resetResources: () => set(DEFAULT_RESOURCES),
    }),
    {
      name: "demo-resources-store",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : sessionStorage,
      ),
      partialize: (state) => ({
        freeCoolDollies: state.freeCoolDollies,
        freeBuildupBays: state.freeBuildupBays,
        freeCoolRoomSlots: state.freeCoolRoomSlots,
      }),
    },
  ),
);
