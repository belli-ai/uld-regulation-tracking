"use client";

import { getShiftedFirstStdMs } from "@/lib/data/flights-shifted";

const ANCHOR_OFFSET_HOURS = 2;

const simulationBaseMs =
  getShiftedFirstStdMs() - ANCHOR_OFFSET_HOURS * 60 * 60 * 1000;
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
