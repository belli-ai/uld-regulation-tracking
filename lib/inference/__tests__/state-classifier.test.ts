import { beforeEach, describe, expect, it } from "vitest";
import { toIRI, type Measurement } from "@/lib/ontology/one-record";
import { parseAirportPolygons } from "@/lib/inference/airport-polygons-loader";
import {
  classifyState,
  getEmittedStateEvents,
  resetStateClassifier,
} from "@/lib/inference/state-classifier";

const polygons = parseAirportPolygons({
  type: "FeatureCollection",
  name: "DXB",
  features: [
    {
      type: "Feature",
      id: "cool-room",
      properties: {
        name: "Cool Room",
        purpose: "Cargo Mega Terminal cool zone",
        referenceAmbientC: 5,
        referenceAmbientDeltaC: null,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.358, 25.2458],
            [55.359, 25.2458],
            [55.359, 25.2464],
            [55.358, 25.2464],
            [55.358, 25.2458],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "build-up-area",
      properties: {
        name: "Build-Up Area",
        purpose: "Build-up bays floor",
        referenceAmbientC: 22,
        referenceAmbientDeltaC: null,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.3592, 25.2467],
            [55.3602, 25.2467],
            [55.3602, 25.2473],
            [55.3592, 25.2473],
            [55.3592, 25.2467],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "apron-staging-1",
      properties: {
        name: "Apron Staging 1",
        purpose: "Apron staging near terminal",
        referenceAmbientDeltaC: 0,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.3495, 25.2437],
            [55.3505, 25.2437],
            [55.3505, 25.2443],
            [55.3495, 25.2443],
            [55.3495, 25.2437],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "apron-staging-2",
      properties: {
        name: "Apron Staging 2",
        purpose: "Apron staging far west",
        referenceAmbientDeltaC: 0,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.3515, 25.2447],
            [55.3525, 25.2447],
            [55.3525, 25.2453],
            [55.3515, 25.2453],
            [55.3515, 25.2447],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "tarmac-shadow-jetbridge",
      properties: {
        name: "Tarmac Shadow — Gate B12 Jet Bridge",
        purpose: "Shadow zone near gate B12 jet bridge",
        referenceAmbientDeltaC: -4,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.362, 25.2507],
            [55.363, 25.2507],
            [55.363, 25.2513],
            [55.362, 25.2513],
            [55.362, 25.2507],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "tarmac-shadow-tail",
      properties: {
        name: "Tarmac Shadow — Gate B14 Tail",
        purpose: "Shadow zone near gate B14 tail",
        referenceAmbientDeltaC: -3,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.363, 25.2512],
            [55.364, 25.2512],
            [55.364, 25.2518],
            [55.363, 25.2518],
            [55.363, 25.2512],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "gate-A12",
      properties: {
        name: "Gate A12",
        purpose: "Active loading position gate A12",
        referenceAmbientDeltaC: 0,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [55.3645, 25.2522],
            [55.3655, 25.2522],
            [55.3655, 25.2528],
            [55.3645, 25.2528],
            [55.3645, 25.2522],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "runway-25R",
      properties: {
        name: "Runway 25R",
        purpose: "Departure runway centreline; in-flight transition trigger",
        referenceAmbientDeltaC: null,
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [55.354, 25.248],
          [55.37, 25.24],
        ],
      },
    },
  ],
});

function makeMeasurement(
  id: string,
  timestamp: string,
  latitude: number,
  longitude: number,
  temperatureC: number,
  altitudeM = 0,
): Measurement & { altitudeM: number } {
  return {
    "@id": toIRI(`urn:cargo:measurement:${id}`),
    "@type": "Measurement",
    measurementValue: {
      value: temperatureC,
      unit: "C",
    },
    measurementTimestamp: timestamp,
    recordedGeolocation: {
      latitude,
      longitude,
    },
    bySensor: toIRI("urn:cargo:sensor:test"),
    altitudeM,
  };
}

describe("classifyState", () => {
  beforeEach(() => {
    resetStateClassifier();
  });

  it("returns in-warehouse / cool-room for a cool-room geofence hit near 5C", () => {
    const result = classifyState(
      "AKE-12345EK",
      [
        makeMeasurement(
          "cool-room",
          "2026-04-25T08:00:00Z",
          25.2461,
          55.3585,
          5.2,
        ),
      ],
      polygons,
    );

    expect(result.stage).toBe("in-warehouse");
    expect(result.internalSubState).toBe("cool-room");
    expect(result.source).toBe("measured");
  });

  it("returns in-tarmac / staging for an apron staging geofence hit in hot ambient", () => {
    const result = classifyState(
      "AKE-22219EK",
      [
        makeMeasurement(
          "apron",
          "2026-04-25T08:10:00Z",
          25.244,
          55.35,
          40,
        ),
      ],
      polygons,
    );

    expect(result.stage).toBe("in-tarmac");
    expect(result.internalSubState).toBe("staging");
    expect(result.source).toBe("measured");
  });

  it("returns in-flight for telemetry far from DXB with non-zero altitude", () => {
    const result = classifyState(
      "RKN-99001EK",
      [
        makeMeasurement(
          "flight",
          "2026-04-25T08:20:00Z",
          30,
          30,
          8,
          11000,
        ),
      ],
      polygons,
    );

    expect(result.stage).toBe("in-flight");
    expect(result.internalSubState).toBeNull();
    expect(result.source).toBe("measured");
  });

  it("emits exactly one LogisticsEvent for a warehouse-to-tarmac crossing", () => {
    classifyState(
      "AKW-44401EK",
      [
        makeMeasurement(
          "boundary-1",
          "2026-04-25T09:00:00Z",
          25.2461,
          55.3585,
          5.1,
        ),
        makeMeasurement(
          "boundary-2",
          "2026-04-25T09:01:00Z",
          25.2462,
          55.3586,
          5.3,
        ),
        makeMeasurement(
          "boundary-3",
          "2026-04-25T09:02:00Z",
          25.244,
          55.35,
          39,
        ),
        makeMeasurement(
          "boundary-4",
          "2026-04-25T09:03:00Z",
          25.2441,
          55.3501,
          40,
        ),
        makeMeasurement(
          "boundary-5",
          "2026-04-25T09:04:00Z",
          25.2442,
          55.3502,
          40.5,
        ),
      ],
      polygons,
    );

    const events = getEmittedStateEvents("AKW-44401EK");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      "@type": "LogisticsEvent",
      eventCode: "STATE_TARMAC_IN",
      eventFor: toIRI("urn:cargo:uld:AKW-44401EK"),
    });
  });
});
