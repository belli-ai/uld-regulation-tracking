import { describe, expect, it } from "vitest";

import stationsConfig from "@/public/config/stations.json";
import { ACTION_LIBRARY, type Action } from "@/lib/recommender/action-library";
import {
  filterActions,
  type Resources,
  type StationCapabilities,
  type UldContext,
} from "@/lib/recommender/filters";

const dxbStation: StationCapabilities = stationsConfig.DXB;

const allResources: Resources = {
  freeCoolDollies: 2,
  freeBuildupBays: 1,
  freeShadingZones: 2,
  thermalBlanketStock: 10,
};

describe("filterActions", () => {
  it("filters out cool-dolly actions when no free cool dollies are available", () => {
    const ctx: UldContext = {
      uldId: "ULD-AVI-001",
      shc: ["AVI"],
      state: "in-tarmac",
      timeToBreach: 30,
    };

    const result = filterActions(ACTION_LIBRARY, ctx, dxbStation, {
      ...allResources,
      freeCoolDollies: 0,
    });

    expect(result.some((action) => action.id.includes("cool-dolly"))).toBe(false);
  });

  it("filters out actions that cannot be executed before the breach", () => {
    const longAction: Action = {
      id: "ops-long-action-001",
      category: "ops",
      label: "Long escalation path",
      benefitHours: [1, 2],
      costTier: "medium",
      authority: "ops-control",
      executionMinutes: 60,
      requiresStationCapability: [],
      applicableStates: ["in-tarmac"],
      applicableShc: [],
    };

    const ctx: UldContext = {
      uldId: "ULD-COL-002",
      shc: ["COL"],
      state: "in-tarmac",
      timeToBreach: 30,
    };

    const result = filterActions([longAction], ctx, dxbStation, allResources);

    expect(result).toEqual([]);
  });

  it("returns only actions applicable to the current state and SHC", () => {
    const ctx: UldContext = {
      uldId: "ULD-COL-003",
      shc: ["COL"],
      state: "in-tarmac",
      timeToBreach: 60,
    };

    const result = filterActions(ACTION_LIBRARY, ctx, dxbStation, allResources);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((action) => action.applicableStates.includes("in-tarmac"))).toBe(
      true,
    );
    expect(
      result.every(
        (action) =>
          action.applicableShc.length === 0 || action.applicableShc.includes("COL"),
      ),
    ).toBe(true);
  });
});
