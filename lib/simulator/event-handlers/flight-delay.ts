import type { RunnerContext } from "@/lib/simulator/scenario-runner";
import type { ScenarioEvent } from "@/lib/simulator/scenario-schema";

function shiftIsoTimestamp(isoTimestamp: string, deltaMinutes: number): string {
  const timestampMs = Date.parse(isoTimestamp);
  if (Number.isNaN(timestampMs)) {
    return isoTimestamp;
  }

  return new Date(timestampMs + deltaMinutes * 60_000).toISOString();
}

export async function handleFlightDelay(
  event: ScenarioEvent,
  ctx: RunnerContext,
): Promise<void> {
  const flightNo =
    typeof event.flight === "string"
      ? event.flight
      : typeof event.flightNo === "string"
        ? event.flightNo
        : null;
  const deltaMinutes =
    typeof event.delta_min === "number" ? Math.floor(event.delta_min) : 0;

  if (!flightNo || deltaMinutes === 0) {
    return;
  }

  ctx.setState((state) => ({
    flights: state.flights.map((flight) =>
      flight.flightNumber === flightNo
        ? {
            ...flight,
            delayMinutes: flight.delayMinutes + deltaMinutes,
            movementTimes: flight.movementTimes.map((movement) =>
              movement.type === "STD" || movement.type === "STA"
                ? {
                    ...movement,
                    timestamp: shiftIsoTimestamp(movement.timestamp, deltaMinutes),
                  }
                : movement,
            ),
          }
        : flight,
    ),
    selectedFlightNo: flightNo,
    statusMessage: `${flightNo} delayed by ${deltaMinutes} minutes`,
  }));
  ctx.syncFlightsToStore();

  ctx.addLog(`${flightNo} delayed by ${deltaMinutes} minutes`, "warning");
}
