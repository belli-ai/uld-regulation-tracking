"use client";

import { create } from "zustand";
import type { TransportMovement } from "@/lib/ontology/one-record";
import { getShiftedFlights } from "@/lib/data/flights-shifted";

type WeatherSource = "live" | "mock";

type FlightsResponse = {
  data: TransportMovement[];
};

type WeatherResponse = {
  source: WeatherSource;
};

type FlightsState = {
  flights: TransportMovement[];
  weatherSource: WeatherSource | null;
  loading: boolean;
  error: string | null;
  loadFlights: () => Promise<void>;
};

function isTransportMovementArray(
  value: unknown,
): value is TransportMovement[] {
  return Array.isArray(value);
}

function isWeatherSource(value: unknown): value is WeatherSource {
  return value === "live" || value === "mock";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load outbound flights";
}

export const useFlightsStore = create<FlightsState>()((set) => ({
  flights: [],
  weatherSource: null,
  loading: false,
  error: null,
  async loadFlights() {
    set({ loading: true, error: null });

    try {
      const [flightsResponse, weatherResponse] = await Promise.all([
        fetch("/api/flights", { cache: "no-store" }),
        fetch("/api/weather?airport=DXB", { cache: "no-store" }),
      ]);

      if (!flightsResponse.ok) {
        throw new Error(
          `Flights request failed with ${flightsResponse.status}`,
        );
      }

      if (!weatherResponse.ok) {
        throw new Error(
          `Weather request failed with ${weatherResponse.status}`,
        );
      }

      const flightsJson: unknown = await flightsResponse.json();
      const weatherJson: unknown = await weatherResponse.json();

      const flightsData = (flightsJson as Partial<FlightsResponse>).data;
      const weatherSource = (weatherJson as Partial<WeatherResponse>).source;

      // Server-rendered /api/flights returns unshifted JSON (server can't see
      // localStorage). Apply the client-side scenario-anchor shift here so
      // every consumer of the store sees the same time-shifted flights as
      // the simulation clock and recalculator do.
      const baseFlights = isTransportMovementArray(flightsData)
        ? flightsData
        : [];
      const shifted = baseFlights.length > 0 ? getShiftedFlights() : [];

      set({
        flights: shifted.length > 0 ? shifted : baseFlights,
        weatherSource: isWeatherSource(weatherSource) ? weatherSource : null,
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      set({
        flights: [],
        weatherSource: null,
        loading: false,
        error: getErrorMessage(error),
      });
    }
  },
}));
