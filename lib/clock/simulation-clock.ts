"use client";

import { getShiftedFirstStdMs } from "@/lib/data/flights-shifted";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

const ANCHOR_OFFSET_HOURS = 2;
// 1 tick = 10 sim minutes. Combined with SimulateToggle's 1 Hz interval,
// 1× speed advances the sim 10 minutes per real second; 10× → 100 min/s.
export const MS_PER_DEMO_TICK = 10 * 60_000;

const simulationBaseMs =
  getShiftedFirstStdMs() - ANCHOR_OFFSET_HOURS * 60 * 60 * 1000;
const realAnchorMs = Date.now();

export function getSimulationNowMs(): number {
  return simulationBaseMs + (Date.now() - realAnchorMs);
}

export function getSimulationBaseMs(): number {
  return simulationBaseMs;
}

export function getRealAnchorMs(): number {
  return realAnchorMs;
}

/**
 * Single source for "what time is it in the simulation right now" used by
 * the recalculator AND by every UI surface that displays weather, clock,
 * or budget. When the user has clicked Simulate (or has any tick > 0,
 * meaning they previously played), the sim follows the demo clock; until
 * they engage the simulator we anchor to the wall clock.
 */
export function getEffectiveSimulationNowMs(): number {
  const demoState = useDemoClockStore.getState();
  if (demoState.currentTickSec > 0 || demoState.playState === "playing") {
    return simulationBaseMs + demoState.currentTickSec * MS_PER_DEMO_TICK;
  }
  return getSimulationNowMs();
}
