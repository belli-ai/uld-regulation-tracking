"use client";

import { useEffect, useState } from "react";

import { getEffectiveSimulationNowMs } from "@/lib/clock/simulation-clock";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

/**
 * Re-renders the consumer with the current simulation timestamp.
 * Tracks both the real-time fallback (1Hz) and the demo clock (reactive).
 * Use everywhere the UI needs to display sim time — weather panels,
 * clocks, countdown labels — so they all agree with the recalculator.
 */
export function useSimulationNow(refreshMs = 1_000): number {
  const demoTick = useDemoClockStore((s) => s.currentTickSec);
  const playState = useDemoClockStore((s) => s.playState);
  const [now, setNow] = useState<number>(() => getEffectiveSimulationNowMs());

  useEffect(() => {
    setNow(getEffectiveSimulationNowMs());
    const id = window.setInterval(() => {
      setNow(getEffectiveSimulationNowMs());
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [demoTick, playState, refreshMs]);

  return now;
}
