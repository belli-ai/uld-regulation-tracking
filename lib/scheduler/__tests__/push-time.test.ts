import { describe, expect, it } from "vitest";
import rawShcConfig from "../../../public/config/shc.json";
import { pushTime } from "@/lib/scheduler/push-time";
import {
  linearInterpolate,
  parseShcConfig,
} from "@/lib/scheduler/shc-loader";

const shcConfig = parseShcConfig(rawShcConfig);

describe("pushTime", () => {
  it("interpolates AVI max wait at 38C from the configured ambient curve", () => {
    const aviCurve = shcConfig.shc.AVI.maxWaitMinutes;
    const expected = linearInterpolate(38, aviCurve);
    const loadedAt = new Date("2026-04-25T08:00:00.000Z");

    const result = pushTime(
      {
        uldId: "ULD-AVI-1",
        shcCode: "AVI",
        loadedAt,
      },
      {
        std: new Date("2026-04-25T10:00:00.000Z"),
        etd: new Date("2026-04-25T10:00:00.000Z"),
        towEstimateMinutes: 20,
      },
      { ambientC: 38 },
      shcConfig,
      new Date("2026-04-25T08:05:00.000Z").getTime(),
    );

    expect(result.maxWaitAir).toBeCloseTo(expected, 2);
  });

  it("keeps COL push time anchored to loadedAt plus max wait even when ETD slips by 90 minutes", () => {
    const loadedAt = new Date("2026-04-25T08:00:00.000Z");
    const std = new Date("2026-04-25T12:00:00.000Z");
    const delayedEtd = new Date("2026-04-25T13:30:00.000Z");
    const nowMs = new Date("2026-04-25T09:00:00.000Z").getTime();

    const baseline = pushTime(
      {
        uldId: "ULD-COL-1",
        shcCode: "COL",
        loadedAt,
      },
      {
        std,
        etd: std,
        towEstimateMinutes: 30,
      },
      { ambientC: 25 },
      shcConfig,
      nowMs,
    );

    const delayed = pushTime(
      {
        uldId: "ULD-COL-1",
        shcCode: "COL",
        loadedAt,
      },
      {
        std,
        etd: delayedEtd,
        towEstimateMinutes: 30,
      },
      { ambientC: 25 },
      shcConfig,
      nowMs,
    );

    expect(delayed.pushTime.getTime()).toBe(baseline.pushTime.getTime());
    expect(delayed.maxWaitAir).toBe(baseline.maxWaitAir);
    expect(delayed.holdDecision).toBe("HOLD");
  });

  it("treats the exact tow-window boundary as PUSH, above it as HOLD, and below it as PUSH", () => {
    const loadedAt = new Date("2026-04-25T08:00:00.000Z");
    const resultAtAmbient = pushTime(
      {
        uldId: "ULD-PER-1",
        shcCode: "PER",
        loadedAt,
      },
      {
        std: new Date("2026-04-25T11:00:00.000Z"),
        etd: new Date("2026-04-25T11:00:00.000Z"),
        towEstimateMinutes: 30,
      },
      { ambientC: 35 },
      shcConfig,
      loadedAt.getTime(),
    );

    const pushTimeMs = resultAtAmbient.pushTime.getTime();
    const towWindowMs = 30 * 60_000;
    const boundaryNowMs = pushTimeMs - towWindowMs;

    const justAboveBoundary = pushTime(
      {
        uldId: "ULD-PER-1",
        shcCode: "PER",
        loadedAt,
      },
      {
        std: new Date("2026-04-25T11:00:00.000Z"),
        etd: new Date("2026-04-25T11:00:00.000Z"),
        towEstimateMinutes: 30,
      },
      { ambientC: 35 },
      shcConfig,
      boundaryNowMs - 1,
    );

    const exactBoundary = pushTime(
      {
        uldId: "ULD-PER-1",
        shcCode: "PER",
        loadedAt,
      },
      {
        std: new Date("2026-04-25T11:00:00.000Z"),
        etd: new Date("2026-04-25T11:00:00.000Z"),
        towEstimateMinutes: 30,
      },
      { ambientC: 35 },
      shcConfig,
      boundaryNowMs,
    );

    const justBelowBoundary = pushTime(
      {
        uldId: "ULD-PER-1",
        shcCode: "PER",
        loadedAt,
      },
      {
        std: new Date("2026-04-25T11:00:00.000Z"),
        etd: new Date("2026-04-25T11:00:00.000Z"),
        towEstimateMinutes: 30,
      },
      { ambientC: 35 },
      shcConfig,
      boundaryNowMs + 1,
    );

    expect(justAboveBoundary.holdDecision).toBe("HOLD");
    expect(exactBoundary.holdDecision).toBe("PUSH");
    expect(justBelowBoundary.holdDecision).toBe("PUSH");
  });
});
