"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlightCard } from "@/components/flight-card";
import {
  MetricTile,
  MissionPanel,
  MissionShell,
  MissionTopBar,
  StatusRail,
} from "@/components/mission-control";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFlightsStore } from "@/lib/stores/flights-store";
import { cn } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <Card className="bg-card text-card-foreground border py-6 shadow-sm">
      <div className="flex flex-col gap-4 px-6">
        <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-14 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-10 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-12 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function getWeatherBadgeClass(weatherSource: "live" | "mock" | null): string {
  if (weatherSource === "live") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (weatherSource === "mock") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400";
  }

  return "border-border bg-muted text-muted-foreground";
}

function getWeatherBadgeLabel(weatherSource: "live" | "mock" | null): string {
  if (weatherSource === "live") {
    return "LIVE";
  }

  if (weatherSource === "mock") {
    return "MOCK";
  }

  return "WEATHER";
}

function getExtendedFlightValue(flight: unknown, key: string): unknown {
  return (flight as Record<string, unknown>)[key];
}

function getNumberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export default function HomePage() {
  const router = useRouter();
  const flights = useFlightsStore((state) => state.flights);
  const weatherSource = useFlightsStore((state) => state.weatherSource);
  const loading = useFlightsStore((state) => state.loading);
  const error = useFlightsStore((state) => state.error);
  const loadFlights = useFlightsStore((state) => state.loadFlights);

  useEffect(() => {
    void loadFlights();
  }, [loadFlights]);

  const totalAwbs = flights.reduce(
    (sum, flight) =>
      sum + getNumberValue(getExtendedFlightValue(flight, "awbCount")),
    0,
  );
  const totalBuiltUlds = flights.reduce(
    (sum, flight) =>
      sum + getNumberValue(getExtendedFlightValue(flight, "builtUldCount")),
    0,
  );
  const atRiskFlights = flights.filter(
    (flight) => getExtendedFlightValue(flight, "atRisk") === true,
  ).length;

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="DXB mission control"
        title="Cool-Chain Copilot"
        actions={
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs font-semibold",
              getWeatherBadgeClass(weatherSource),
            )}
          >
            {getWeatherBadgeLabel(weatherSource)}
          </Badge>
        }
      />

      <main className="grid h-[calc(100dvh-4rem)] w-full grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 sm:px-6">
        <Card className="mission-panel border-border/80">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(120px,0.5fr))]">
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Outbound operations board
              </div>
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <h1 className="truncate text-3xl font-bold">
                  Today&apos;s flights
                </h1>
                <Badge variant="secondary">DXB outbound</Badge>
              </div>
            </div>
            <MetricTile
              label="Flights"
              value={flights.length}
              meta="Departures"
            />
            <MetricTile label="AWBs" value={totalAwbs} meta="Manifest load" />
            <MetricTile
              label="Built ULDs"
              value={totalBuiltUlds}
              meta="Signed off"
            />
            <MetricTile
              label="Risk watch"
              value={atRiskFlights}
              meta={atRiskFlights === 1 ? "Flight flagged" : "Flights flagged"}
            />
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-h-0 overflow-hidden">
            {error ? (
              <MissionPanel className="h-full" contentClassName="h-full">
                <div className="flex min-h-[240px] items-center justify-center px-6 text-center">
                  <p className="text-base text-destructive">{error}</p>
                </div>
              </MissionPanel>
            ) : null}

            {!error && loading ? (
              <div className="grid h-full auto-rows-min gap-4 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <LoadingSkeleton key={index} />
                ))}
              </div>
            ) : null}

            {!error && !loading && flights.length === 0 ? (
              <MissionPanel className="h-full" contentClassName="h-full">
                <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center">
                  <p className="text-base text-muted-foreground">
                    No outbound flights today
                  </p>
                </div>
              </MissionPanel>
            ) : null}

            {!error && !loading && flights.length > 0 ? (
              <MissionPanel
                className="flex h-full min-h-0 flex-col"
                title="Departure board"
                description="Select a flight to open build-up operations."
                contentClassName="min-h-0 flex-1 overflow-y-auto"
              >
                <div className="grid auto-rows-min gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {flights.map((flight) => (
                    <FlightCard
                      key={flight["@id"]}
                      flight={flight}
                      onClick={() =>
                        router.push("/flight/" + flight.flightNumber)
                      }
                    />
                  ))}
                </div>
              </MissionPanel>
            ) : null}
          </section>

          <StatusRail className="min-h-0 overflow-y-auto">
            <MetricTile
              label="Station"
              value="DXB"
              meta="Outbound cold-chain hub"
            />
            <MetricTile
              label="Risk watch"
              value={atRiskFlights}
              meta={atRiskFlights === 1 ? "Flight flagged" : "Flights flagged"}
            />
            <MetricTile
              label="Weather"
              value={getWeatherBadgeLabel(weatherSource)}
              meta="Source currently active"
            />
            <MissionPanel
              title="Command cue"
              description="Demo path begins with EK0083, then advances to build-up and ULD detail."
              contentClassName="text-sm text-muted-foreground"
            >
              Prioritize flights with built ULD risk, then drill into the
              workspace.
            </MissionPanel>
          </StatusRail>
        </div>
      </main>
    </MissionShell>
  );
}
