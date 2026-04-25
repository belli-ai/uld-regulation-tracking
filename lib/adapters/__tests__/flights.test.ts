import { describe, expect, it } from "vitest";
import { adaptMockFlights } from "@/lib/adapters/flights";

describe("adaptMockFlights", () => {
  it("produces canonical TransportMovement records", () => {
    const raw = [
      {
        "@id": "urn:cargo:flight:EK0083",
        "@type": "TransportMovement",
        modeCode: "Air",
        flightNumber: "EK0083",
        departureLocation: "urn:cargo:loc:DXB",
        arrivalLocation: "urn:cargo:loc:FRA",
        movementTimes: [
          { type: "STD", timestamp: "2026-04-25T14:20:00+04:00" },
          { type: "STA", timestamp: "2026-04-25T19:05:00+02:00" },
        ],
        operatingParties: ["urn:cargo:carrier:EK"],
        loadingActions: [],
      },
    ];

    const flights = adaptMockFlights(raw);

    expect(flights).toHaveLength(1);
    const flight = flights[0];
    expect(flight["@type"]).toBe("TransportMovement");
    expect(flight.flightNumber).toBe("EK0083");
    expect(flight.modeCode).toBe("Air");
    expect(flight.departureLocation).toBe("urn:cargo:loc:DXB");
    expect(flight.arrivalLocation).toBe("urn:cargo:loc:FRA");
    expect(flight.movementTimes).toEqual([
      { type: "STD", timestamp: "2026-04-25T14:20:00+04:00" },
      { type: "STA", timestamp: "2026-04-25T19:05:00+02:00" },
    ]);
    expect(flight.operatingParties).toEqual(["urn:cargo:carrier:EK"]);
    expect(flight.loadingActions).toEqual([]);
  });

  it("drops invalid movementTime entries and stays an array", () => {
    const flights = adaptMockFlights([
      {
        "@id": "urn:cargo:flight:EK0237",
        flightNumber: "EK0237",
        departureLocation: "urn:cargo:loc:DXB",
        arrivalLocation: "urn:cargo:loc:LHR",
        movementTimes: [
          { type: "STD", timestamp: "2026-04-25T14:50:00+04:00" },
          { type: "BOGUS", timestamp: "whenever" },
          { timestamp: "no-type" },
        ],
        operatingParties: [],
        loadingActions: [],
      },
    ]);

    expect(flights[0].movementTimes).toEqual([
      { type: "STD", timestamp: "2026-04-25T14:50:00+04:00" },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(adaptMockFlights(null)).toEqual([]);
    expect(adaptMockFlights({})).toEqual([]);
  });
});
