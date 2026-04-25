"use client";

import { useEffect } from "react";

import {
  getSimulationBaseMs,
  getSimulationNowMs,
} from "@/lib/clock/simulation-clock";
import { recalculateAll } from "@/lib/physics/recalculator";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

const TICK_MS = 5_000;

// 1 tick = 1 sim-MINUTE so the budget actually moves at human-visible
// rates. At 1× speed (skip(1) every 1s real), the sim advances 1 minute
// per real second; at 10×, 10 sim-minutes per real second.
const MS_PER_TICK = 60_000;

function effectiveNowMs(): number {
  const demoState = useDemoClockStore.getState();
  // Holding here means we always return the simulationBase + tick offset,
  // never the real-time anchored fallback. Paused = time stops; toggling
  // pause/play has no jump because the same formula is used both ways.
  if (demoState.currentTickSec > 0 || demoState.playState === "playing") {
    return getSimulationBaseMs() + demoState.currentTickSec * MS_PER_TICK;
  }
  return getSimulationNowMs();
}

export function RecalculatorRoot() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await recalculateAll(effectiveNowMs());
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
