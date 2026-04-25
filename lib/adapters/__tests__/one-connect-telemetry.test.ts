import { describe, expect, it, vi } from "vitest";
import { NS } from "@/lib/adapters/one-connect/json-ld";
import {
  adaptOneConnectMeasurement,
  notificationsToMeasurements,
} from "@/lib/adapters/one-connect/telemetry";

function notification(type: string, iri: string): Record<string, unknown> {
  return {
    "@type": "api:Notification",
    "api:hasLogisticsObjectType": `${NS.cargo}${type}`,
    "api:hasLogisticsObject": { "@id": iri },
  };
}

function measurement(
  id: string,
  opts: { unit?: string; bySensor?: string; value?: string | number } = {},
): Record<string, unknown> {
  return {
    "@id": id,
    "@type": "cargo:Measurement",
    "cargo:measurementValue": {
      "@type": "cargo:Value",
      "cargo:numericalValue": opts.value ?? "2.5",
      "cargo:unit": { "@id": opts.unit ?? `${NS.unit}CEL` },
    },
    "cargo:measurementTimestamp": { "@value": "2026-04-26T01:02:03Z" },
    ...(opts.bySensor ? { "cargo:bySensor": { "@id": opts.bySensor } } : {}),
  };
}

describe("notificationsToMeasurements", () => {
  it("returns empty indexes for an empty notification batch", async () => {
    const fetchEmbedded = vi.fn();

    const result = await notificationsToMeasurements([], fetchEmbedded);

    expect(result.measurements).toEqual([]);
    expect(result.byUld).toEqual({});
    expect(result.bySensor).toEqual({});
    expect(fetchEmbedded).not.toHaveBeenCalled();
  });

  it("ignores notifications outside ULD, Sensor, IotDevice, and Measurement", async () => {
    const fetchEmbedded = vi.fn();

    const result = await notificationsToMeasurements(
      [notification("Piece", "urn:piece:1")],
      fetchEmbedded,
    );

    expect(result.measurements).toEqual([]);
    expect(fetchEmbedded).not.toHaveBeenCalled();
  });

  it("adapts a top-level Measurement node fetched from a notification", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue({
      ...measurement("urn:measurement:1", { bySensor: "urn:sensor:1" }),
      "cargo:recordedGeolocation": { latitude: "22.31", longitude: "114.17" },
    });

    const result = await notificationsToMeasurements(
      [notification("Measurement", "urn:measurement:1")],
      fetchEmbedded,
    );

    expect(fetchEmbedded).toHaveBeenCalledWith("urn:measurement:1");
    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0]).toMatchObject({
      "@id": "urn:measurement:1",
      "@type": "Measurement",
      measurementValue: { value: 2.5, unit: "C" },
      measurementTimestamp: "2026-04-26T01:02:03.000Z",
      recordedGeolocation: { latitude: 22.31, longitude: 114.17 },
      bySensor: "urn:sensor:1",
    });
    expect(result.bySensor["urn:sensor:1"]).toHaveLength(1);
  });

  it("walks ULD to Sensor to Measurement and indexes by ULD and Sensor", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue({
      "@id": "urn:uld:AKE-12345EK",
      "@type": "cargo:ULD",
      "cargo:sensors": [
        {
          "@id": "urn:sensor:temperature-1",
          "@type": "cargo:Sensor",
          "cargo:measurements": [measurement("urn:measurement:nested-1")],
        },
      ],
    });

    const result = await notificationsToMeasurements(
      [notification("ULD", "urn:uld:AKE-12345EK")],
      fetchEmbedded,
    );

    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0].bySensor).toBe("urn:sensor:temperature-1");
    expect(result.byUld["urn:uld:AKE-12345EK"]).toHaveLength(1);
    expect(result.bySensor["urn:sensor:temperature-1"]).toHaveLength(1);
  });

  it("dedupes measurements by @id across notifications", async () => {
    const fetchEmbedded = vi
      .fn()
      .mockResolvedValue(measurement("urn:measurement:dupe", { bySensor: "urn:sensor:1" }));

    const result = await notificationsToMeasurements(
      [
        notification("Measurement", "urn:measurement:dupe"),
        notification("Measurement", "urn:measurement:dupe"),
      ],
      fetchEmbedded,
    );

    expect(result.measurements).toHaveLength(1);
    expect(fetchEmbedded).toHaveBeenCalledTimes(2);
  });

  it("skips malformed measurements missing measurementValue", async () => {
    const fetchEmbedded = vi.fn().mockResolvedValue({
      "@id": "urn:measurement:bad",
      "@type": "cargo:Measurement",
      "cargo:measurementTimestamp": "2026-04-26T01:02:03Z",
      "cargo:bySensor": { "@id": "urn:sensor:1" },
    });

    const result = await notificationsToMeasurements(
      [notification("Measurement", "urn:measurement:bad")],
      fetchEmbedded,
    );

    expect(result.measurements).toEqual([]);
  });

  it("coerces CEL to C and KGM to kg measurement units", () => {
    const cel = adaptOneConnectMeasurement(
      measurement("urn:measurement:cel", { bySensor: "urn:sensor:1", unit: `${NS.unit}CEL` }),
    );
    const kgm = adaptOneConnectMeasurement(
      measurement("urn:measurement:kgm", { bySensor: "urn:sensor:1", unit: `${NS.unit}KGM` }),
    );

    expect(cel?.measurementValue.unit).toBe("C");
    expect(kgm?.measurementValue.unit).toBe("kg");
  });

  it("passes internal unit prefixes through unchanged", () => {
    const result = adaptOneConnectMeasurement(
      measurement("urn:measurement:internal", {
        bySensor: "urn:sensor:1",
        unit: "internal:TEMP_SCORE",
      }),
    );

    expect(result?.measurementValue.unit).toBe("internal:TEMP_SCORE");
  });

  it("continues the batch when fetching one embedded object fails", async () => {
    const fetchEmbedded = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        measurement("urn:measurement:ok", { bySensor: "urn:sensor:ok" }),
      );

    const result = await notificationsToMeasurements(
      [
        notification("Measurement", "urn:measurement:failed"),
        notification("Measurement", "urn:measurement:ok"),
      ],
      fetchEmbedded,
    );

    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0]["@id"]).toBe("urn:measurement:ok");
  });
});
