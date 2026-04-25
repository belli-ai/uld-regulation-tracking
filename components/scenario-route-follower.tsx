"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useScenarioRunnerStore } from "@/lib/simulator/scenario-runner";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

export function ScenarioRouteFollower() {
  const pathname = usePathname();
  const router = useRouter();
  const playState = useDemoClockStore((state) => state.playState);
  const routeAutomationEnabled = useScenarioRunnerStore(
    (state) => state.routeAutomationEnabled,
  );
  const uiRoute = useScenarioRunnerStore((state) => state.uiRoute);

  useEffect(() => {
    if (
      !routeAutomationEnabled ||
      playState !== "playing" ||
      uiRoute.includes("[") ||
      pathname === uiRoute
    ) {
      return;
    }

    router.push(uiRoute);
  }, [pathname, playState, routeAutomationEnabled, router, uiRoute]);

  return null;
}
