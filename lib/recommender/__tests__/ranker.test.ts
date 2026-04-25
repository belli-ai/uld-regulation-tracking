import { describe, expect, it } from "vitest";

import stationsConfig from "@/public/config/stations.json";
import {
  recommendActions,
  type RankedAction,
} from "@/lib/recommender/ranker";
import type {
  Resources,
  StationCapabilities,
  UldContext,
} from "@/lib/recommender/filters";

const dxbStation: StationCapabilities = stationsConfig.DXB;

const baseResources: Resources = {
  freeCoolDollies: 2,
  freeBuildupBays: 1,
  freeShadingZones: 2,
  thermalBlanketStock: 10,
};

function recommendFor(ctx: UldContext, resources: Resources = baseResources): RankedAction[] {
  return recommendActions(ctx, dxbStation, resources);
}

describe("recommendActions", () => {
  it("includes cool-dolly and jet-bridge shading for a COL ULD on tarmac at DXB", () => {
    const result = recommendFor({
      uldId: "ULD-COL-001",
      shc: ["COL"],
      state: "in-tarmac",
      timeToBreach: 60,
    });

    expect(result.some((action) => action.id.includes("cool-dolly"))).toBe(true);
    expect(
      result.some((action) => action.label.toLowerCase().includes("jet-bridge")),
    ).toBe(true);
  });

  it("omits cool-dolly when no free cool dollies are available for AVI", () => {
    const result = recommendFor(
      {
        uldId: "ULD-AVI-001",
        shc: ["AVI"],
        state: "in-tarmac",
        timeToBreach: 30,
      },
      {
        ...baseResources,
        freeCoolDollies: 0,
      },
    );

    expect(result.some((action) => action.id.includes("cool-dolly"))).toBe(false);
  });

  it("materialises a valid LogisticsAction payload", () => {
    const [firstAction] = recommendFor({
      uldId: "ULD-COL-004",
      shc: ["COL"],
      state: "in-tarmac",
      timeToBreach: 60,
    });

    const logisticsAction = firstAction.materialiseAsLogisticsAction(
      "ULD-COL-004",
      new Date("2026-04-25T10:00:00.000Z"),
    );

    expect(logisticsAction["@type"]).toBe("LogisticsAction");
    expect(logisticsAction["@id"]).toContain("urn:");
    expect(logisticsAction.actionStartTime).toBeDefined();
    expect(logisticsAction.actionEndTime).toBeDefined();
    expect(logisticsAction.performedAt).toBeDefined();
  });

  it("returns at most three actions", () => {
    const result = recommendFor({
      uldId: "ULD-COL-005",
      shc: ["COL"],
      state: "in-tarmac",
      timeToBreach: 60,
    });

    expect(result.length).toBeLessThanOrEqual(3);
  });
});
