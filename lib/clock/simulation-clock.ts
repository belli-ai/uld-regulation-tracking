"use client";

import flightsData from "@/public/data/flights.json";
import type { TransportMovement } from "@/lib/ontology/one-record";

const ANCHOR_OFFSET_HOURS = 2;

function getEarliestFlightStdMs(): number {
  const flights = flightsData as unknown as TransportMovement[];
  const stds: number[] = [];
  for (const flight of flights) {
    const std = flight.movementTimes.find((m) => m.type === "STD")?.timestamp;
    if (!std) continue;
    const ms = Date.parse(std);
    if (Number.isFinite(ms)) stds.push(ms);
  }
  if (stds.length === 0) return Date.now();
  return Math.min(...stds);
}

const simulationBaseMs =
  getEarliestFlightStdMs() - ANCHOR_OFFSET_HOURS * 60 * 60 * 1000;
const realAnchorMs = Date.now();

export function getSimulationNowMs(): number {
  return simulationBaseMs + (Date.now() - realAnchorMs);
}

export function getSimulationBaseMs(): number {
  return simulationBaseMs;
}

export function getRealAnchorMs(): number {
  return realAnchorMs;
}
