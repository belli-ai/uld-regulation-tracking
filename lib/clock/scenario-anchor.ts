"use client";

const ANCHOR_KEY = "cool-chain:scenario-anchor-ms";

export const FLIGHT_OFFSETS_HOURS = [2.5, 4, 6, 7.5];
export const ANCHOR_LEAD_HOURS = 2;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getScenarioAnchorMs(): number | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(ANCHOR_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setScenarioAnchorMs(ms: number): void {
  if (!isBrowser()) return;
  localStorage.setItem(ANCHOR_KEY, String(ms));
}

export function clearScenarioAnchorMs(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ANCHOR_KEY);
}

/**
 * Delta to apply to every flight STD/STA so that the first scripted flight
 * sits FLIGHT_OFFSETS_HOURS[0] hours after the reset moment.
 *
 * shift = (anchor + firstOffsetHours*3600s) - originalFirstStdMs
 *
 * Returns 0 when no anchor is set (initial demo state — flight times stay
 * at the JSON timestamps).
 */
export function getFlightTimeShiftMs(originalFirstStdMs: number): number {
  const anchor = getScenarioAnchorMs();
  if (anchor === null) return 0;
  return anchor + FLIGHT_OFFSETS_HOURS[0] * 60 * 60 * 1000 - originalFirstStdMs;
}
