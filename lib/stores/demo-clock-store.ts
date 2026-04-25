"use client";

import { create } from "zustand";

export type DemoPlayState = "paused" | "playing";
export type DemoSpeedMultiplier = 1 | 2 | 5 | 10;

type DemoClockState = {
  currentTickSec: number;
  playState: DemoPlayState;
  speedMultiplier: DemoSpeedMultiplier;
  play: () => void;
  pause: () => void;
  skip: (deltaSec: number) => void;
  reset: () => void;
  tick: () => void;
  setSpeedMultiplier: (speedMultiplier: DemoSpeedMultiplier) => void;
  setCurrentTickSec: (currentTickSec: number) => void;
};

function clampTick(value: number): number {
  return Math.max(0, Math.floor(value));
}

export const useDemoClockStore = create<DemoClockState>()((set) => ({
  currentTickSec: 0,
  playState: "paused",
  speedMultiplier: 1,
  play: () => set({ playState: "playing" }),
  pause: () => set({ playState: "paused" }),
  skip: (deltaSec) =>
    set((state) => ({
      currentTickSec: clampTick(state.currentTickSec + deltaSec),
    })),
  reset: () =>
    set({
      currentTickSec: 0,
      playState: "paused",
      speedMultiplier: 1,
    }),
  tick: () =>
    set((state) => ({
      currentTickSec: state.currentTickSec + 1,
    })),
  setSpeedMultiplier: (speedMultiplier) => set({ speedMultiplier }),
  setCurrentTickSec: (currentTickSec) =>
    set({ currentTickSec: clampTick(currentTickSec) }),
}));
