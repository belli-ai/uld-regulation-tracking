import { describe, expect, it } from "vitest";
import { adaptMockWeather, adaptOpenMeteo } from "@/lib/adapters/weather";

describe("adaptOpenMeteo", () => {
  it("aligns parallel arrays into per-hour readings tagged source=live", () => {
    const raw = {
      hourly: {
        time: ["2026-04-25T12:00:00", "2026-04-25T13:00:00"],
        temperature_2m: [40, 41.5],
        relative_humidity_2m: [55, 50],
        cloud_cover: [25, 20],
      },
      current: { time: "2026-04-25T12:30:00" },
    };
    const out = adaptOpenMeteo(raw, "DXB");
    expect(out.source).toBe("live");
    expect(out.airport).toBe("DXB");
    expect(out.generatedAt).toBe("2026-04-25T12:30:00");
    expect(out.hourly).toEqual([
      {
        timestamp: "2026-04-25T12:00:00",
        ambientC: 40,
        humidityPct: 55,
        cloudCoverPct: 25,
      },
      {
        timestamp: "2026-04-25T13:00:00",
        ambientC: 41.5,
        humidityPct: 50,
        cloudCoverPct: 20,
      },
    ]);
  });

  it("skips entries with missing timestamp or temperature", () => {
    const raw = {
      hourly: {
        time: ["2026-04-25T00:00:00", null],
        temperature_2m: [30, 31],
      },
    };
    const out = adaptOpenMeteo(raw, "DXB");
    expect(out.hourly).toHaveLength(1);
  });
});

describe("adaptMockWeather", () => {
  it("passes through pre-baked hourly readings tagged source=mock", () => {
    const raw = {
      airport: "DXB",
      generatedAt: "2026-04-25T00:00:00+04:00",
      hourly: [
        {
          timestamp: "2026-04-25T14:00:00+04:00",
          ambientC: 42,
          humidityPct: 50,
          cloudCoverPct: 20,
        },
      ],
    };
    const out = adaptMockWeather(raw, "DXB");
    expect(out.source).toBe("mock");
    expect(out.airport).toBe("DXB");
    expect(out.generatedAt).toBe("2026-04-25T00:00:00+04:00");
    expect(out.hourly).toEqual([
      {
        timestamp: "2026-04-25T14:00:00+04:00",
        ambientC: 42,
        humidityPct: 50,
        cloudCoverPct: 20,
      },
    ]);
  });

  it("falls back to airport argument when raw lacks airport key", () => {
    const out = adaptMockWeather({ hourly: [] }, "FRA");
    expect(out.airport).toBe("FRA");
    expect(out.hourly).toEqual([]);
  });
});
