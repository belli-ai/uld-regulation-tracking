function readPositiveIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

// This is evaluated on the server and inlined into client code because NEXT_PUBLIC_* env vars are compile-time public values.
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const simulationTickMs = readPositiveIntegerEnv(
  process.env.NEXT_PUBLIC_SIMULATION_TICK_MS,
  1000,
);
export const trackerLogicalCadenceMs = readPositiveIntegerEnv(
  process.env.NEXT_PUBLIC_TRACKER_LOGICAL_CADENCE_MS,
  10 * 60 * 1000,
);
