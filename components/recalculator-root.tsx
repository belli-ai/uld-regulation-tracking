"use client";

import { useEffect } from "react";

import { getEffectiveSimulationNowMs } from "@/lib/clock/simulation-clock";
import { recalculateAll } from "@/lib/physics/recalculator";

const TICK_MS = 5_000;

export function RecalculatorRoot() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await recalculateAll(getEffectiveSimulationNowMs());
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
