import flightsData from "@/public/data/flights.json";
import type { TransportMovement } from "@/lib/ontology/one-record";
import { getFlightTimeShiftMs } from "@/lib/clock/scenario-anchor";

const flights = flightsData as unknown as TransportMovement[];

function originalFirstStdMs(): number {
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

const ORIGINAL_FIRST_STD_MS = originalFirstStdMs();

function shiftTimestamp(value: string, shiftMs: number): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms + shiftMs).toISOString();
}

export function getOriginalFirstStdMs(): number {
  return ORIGINAL_FIRST_STD_MS;
}

export function getShiftedFlights(): TransportMovement[] {
  const shiftMs = getFlightTimeShiftMs(ORIGINAL_FIRST_STD_MS);
  if (shiftMs === 0) return flights;

  return flights.map((flight) => ({
    ...flight,
    movementTimes: flight.movementTimes.map((entry) => ({
      ...entry,
      timestamp: shiftTimestamp(entry.timestamp, shiftMs),
    })),
  }));
}

export function getShiftedFirstStdMs(): number {
  const shiftMs = getFlightTimeShiftMs(ORIGINAL_FIRST_STD_MS);
  return ORIGINAL_FIRST_STD_MS + shiftMs;
}

export function getCurrentShiftMs(): number {
  return getFlightTimeShiftMs(ORIGINAL_FIRST_STD_MS);
}

/** Shift any { timestamp: ISO } record array by the active flight-shift. */
export function shiftTimestamps<T extends { timestamp?: string }>(
  records: T[],
): T[] {
  const shiftMs = getCurrentShiftMs();
  if (shiftMs === 0) return records;
  return records.map((record) => ({
    ...record,
    timestamp: record.timestamp
      ? shiftTimestamp(record.timestamp, shiftMs)
      : record.timestamp,
  }));
}
