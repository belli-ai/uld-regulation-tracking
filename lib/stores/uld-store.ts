import { create } from "zustand";
import type { ULD, Waybill } from "@/lib/ontology/one-record";

type UldContents = Record<string, Waybill[]>;

type UldStore = {
  ulds: ULD[];
  contents: UldContents;
  addBuiltUld: (uld: ULD, contents: Waybill[]) => void;
  updateUld: (id: string, patch: Partial<ULD>) => void;
};

export const useUldStore = create<UldStore>()((set) => ({
  ulds: [],
  contents: {},
  addBuiltUld: (uld, contents) =>
    set((state) => {
      const existingIndex = state.ulds.findIndex((candidate) => candidate["@id"] === uld["@id"]);
      const nextUlds = [...state.ulds];

      if (existingIndex >= 0) {
        nextUlds[existingIndex] = uld;
      } else {
        nextUlds.push(uld);
      }

      return {
        ulds: nextUlds,
        contents: {
          ...state.contents,
          [uld["@id"]]: contents,
        },
      };
    }),
  updateUld: (id, patch) =>
    set((state) => ({
      ulds: state.ulds.map((uld) =>
        uld["@id"] === id
          ? {
              ...uld,
              ...patch,
            }
          : uld,
      ),
    })),
}));
