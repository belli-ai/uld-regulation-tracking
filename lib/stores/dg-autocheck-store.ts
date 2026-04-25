"use client";

import { create } from "zustand";

import type { DgValidationStatus } from "@/lib/adapters/dg-check";
import type { IRI } from "@/lib/ontology/one-record";

export type DgAutocheckEntry = {
  acceptanceCheckId: string;
  pieceIri: IRI;
  reason?: string;
  requestedUrl?: string;
  requestedUrlExpiresAt?: string;
  status: Extract<DgValidationStatus, "pending" | "valid" | "rejected">;
  updatedAt: string;
  vendorStatus?: string;
};

type DgAutocheckStore = {
  byAcceptanceCheckId: Record<string, DgAutocheckEntry>;
  byPieceIri: Record<string, string>;
  clearByPiece: (pieceIri: IRI) => void;
  upsert: (entry: Omit<DgAutocheckEntry, "updatedAt">) => void;
};

export const useDgAutocheckStore = create<DgAutocheckStore>()((set) => ({
  byAcceptanceCheckId: {},
  byPieceIri: {},
  clearByPiece: (pieceIri) =>
    set((state) => {
      const acceptanceCheckId = state.byPieceIri[pieceIri];
      if (!acceptanceCheckId) {
        return state;
      }

      const nextByAcceptanceCheckId = { ...state.byAcceptanceCheckId };
      const nextByPieceIri = { ...state.byPieceIri };
      delete nextByAcceptanceCheckId[acceptanceCheckId];
      delete nextByPieceIri[pieceIri];

      return {
        byAcceptanceCheckId: nextByAcceptanceCheckId,
        byPieceIri: nextByPieceIri,
      };
    }),
  upsert: (entry) =>
    set((state) => ({
      byAcceptanceCheckId: {
        ...state.byAcceptanceCheckId,
        [entry.acceptanceCheckId]: {
          ...entry,
          updatedAt: new Date().toISOString(),
        },
      },
      byPieceIri: {
        ...state.byPieceIri,
        [entry.pieceIri]: entry.acceptanceCheckId,
      },
    })),
}));
