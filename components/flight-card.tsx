"use client";

import type { KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TransportMovement } from "@/lib/ontology/one-record";
import { cn } from "@/lib/utils";
import { missionCardClassName } from "@/components/mission-control";

type Props = {
  flight: TransportMovement;
  onClick: () => void;
};

function getDestinationLabel(arrivalLocation: string): string {
  const code = arrivalLocation.split(":").at(-1);
  return code?.toUpperCase() || "TBD";
}

function getEtdTimestamp(flight: TransportMovement): string | null {
  const etd = flight.movementTimes.find(
    (movementTime) => movementTime.type === "STD",
  );
  return etd?.timestamp ?? null;
}

function formatEtd(timestamp: string | null): string {
  if (!timestamp) {
    return "--:--";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getExtendedFlightValue(
  flight: TransportMovement,
  key: string,
): unknown {
  return (flight as TransportMovement & Record<string, unknown>)[key];
}

function getCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getAtRiskFlag(flight: TransportMovement): boolean {
  const atRisk = getExtendedFlightValue(flight, "atRisk");
  return atRisk === true;
}

function getAwbCount(flight: TransportMovement): number {
  return getCount(getExtendedFlightValue(flight, "awbCount"));
}

function getBuiltUldCount(flight: TransportMovement): number {
  return getCount(getExtendedFlightValue(flight, "builtUldCount"));
}

function getTotalUldCount(flight: TransportMovement): number {
  return getCount(getExtendedFlightValue(flight, "totalUldCount"));
}

function handleKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  onClick: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onClick();
  }
}

export function FlightCard({ flight, onClick }: Props) {
  const destination = getDestinationLabel(flight.arrivalLocation);
  const etd = formatEtd(getEtdTimestamp(flight));
  const awbCount = getAwbCount(flight);
  const builtUldCount = getBuiltUldCount(flight);
  const totalUldCount = getTotalUldCount(flight);
  const isAtRisk = getAtRiskFlag(flight) && builtUldCount > 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => handleKeyDown(event, onClick)}
      className={cn(
        missionCardClassName,
        "group cursor-pointer py-5 transition-all hover:border-primary/60 hover:shadow-primary/10",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-4 pt-0">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Outbound slot
          </p>
          <h2 className="font-mono text-3xl font-bold leading-none tracking-[-0.06em] text-foreground">
            {flight.flightNumber}
          </h2>
        </div>
        {isAtRisk ? <Badge variant="destructive">Urgent</Badge> : null}
      </CardHeader>
      <CardContent className="px-5 pb-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border border-border/70 bg-background/45 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ETD
            </span>
            <span className="block pt-1 font-mono text-xl font-bold text-foreground">
              {etd}
            </span>
          </div>
          <div className="border border-border/70 bg-background/45 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Destination
            </span>
            <span className="block pt-1 font-mono text-xl font-bold text-foreground">
              {destination}
            </span>
          </div>
          <div className="border border-border/70 bg-background/45 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              AWBs
            </span>
            <span className="block pt-1 text-base text-foreground">
              {awbCount}
            </span>
          </div>
          <div className="border border-border/70 bg-background/45 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ULDs built
            </span>
            <span className="block pt-1 text-base text-foreground">
              {builtUldCount}/{totalUldCount}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
