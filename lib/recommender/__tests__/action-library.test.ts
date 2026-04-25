import { describe, expect, it } from "vitest";

import { ACTION_LIBRARY } from "@/lib/recommender/action-library";

describe("ACTION_LIBRARY", () => {
  it("has at least 25 entries", () => {
    expect(ACTION_LIBRARY.length).toBeGreaterThanOrEqual(25);
  });

  it("includes the required action fields on every entry", () => {
    for (const action of ACTION_LIBRARY) {
      expect(action).toHaveProperty("id");
      expect(action).toHaveProperty("category");
      expect(action).toHaveProperty("label");
      expect(action).toHaveProperty("benefitHours");
      expect(action.benefitHours).toHaveLength(2);
      expect(action).toHaveProperty("costTier");
      expect(action).toHaveProperty("authority");
      expect(action).toHaveProperty("executionMinutes");
      expect(Array.isArray(action.requiresStationCapability)).toBe(true);
      expect(Array.isArray(action.applicableStates)).toBe(true);
      expect(Array.isArray(action.applicableShc)).toBe(true);
    }
  });

  it("contains DOC-001", () => {
    expect(ACTION_LIBRARY.some((action) => action.id === "DOC-001")).toBe(true);
  });
});
