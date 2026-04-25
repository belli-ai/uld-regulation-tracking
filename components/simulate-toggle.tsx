"use client";

import { useEffect } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScenarioRunnerStore } from "@/lib/simulator/scenario-runner";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

const TICK_INTERVAL_MS = 1_000;

export function SimulateToggle() {
  const playState = useDemoClockStore((s) => s.playState);
  const speedMultiplier = useDemoClockStore((s) => s.speedMultiplier);
  const play = useDemoClockStore((s) => s.play);
  const pause = useDemoClockStore((s) => s.pause);
  const skip = useDemoClockStore((s) => s.skip);
  const routeAutomationEnabled = useScenarioRunnerStore(
    (s) => s.routeAutomationEnabled,
  );

  useEffect(() => {
    if (playState !== "playing" || routeAutomationEnabled) return;
    const id = window.setInterval(() => {
      skip(speedMultiplier);
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playState, routeAutomationEnabled, speedMultiplier, skip]);

  const isPlaying = playState === "playing";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <Button
        type="button"
        size="lg"
        variant={isPlaying ? "outline" : "default"}
        className="pointer-events-auto h-12 gap-2 px-5 font-mono shadow-lg"
        onClick={() => (isPlaying ? pause() : play())}
      >
        {isPlaying ? (
          <>
            <Pause className="size-4" /> Pause sim
          </>
        ) : (
          <>
            <Play className="size-4" /> Simulate
          </>
        )}
      </Button>
    </div>
  );
}
