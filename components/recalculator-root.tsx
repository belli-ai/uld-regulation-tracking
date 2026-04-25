"use client";

import { useEffect } from "react";

import { recalculateAll } from "@/lib/physics/recalculator";

const TICK_MS = 5_000;

export function RecalculatorRoot() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await recalculateAll();
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
