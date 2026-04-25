"use client";

import { useEffect } from "react";

import {
  getSimulationBaseMs,
  getSimulationNowMs,
} from "@/lib/clock/simulation-clock";
import { recalculateAll } from "@/lib/physics/recalculator";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

const TICK_MS = 5_000;

function effectiveNowMs(): number {
  const demoState = useDemoClockStore.getState();
  if (demoState.playState === "playing") {
    return getSimulationBaseMs() + demoState.currentTickSec * 1000;
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
