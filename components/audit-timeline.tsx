"use client";

import { AlertTriangle, Package, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from "@/lib/ontology/one-record";
import { cn } from "@/lib/utils";

type Props = {
  actions: LogisticsAction[];
  events: LogisticsEvent[];
  loadings: Loading[];
};

type TimelineEntry = {
  id: string;
  kind: "event" | "action" | "loading";
  location: string;
  outcome: string;
  timestamp: string;
  title: string;
};

function readIdentifierValue(
  identifiers: string[] | undefined,
  prefix: string,
): string | null {
  const match = identifiers?.find((identifier) =>
    identifier.startsWith(prefix),
  );

  return match ? match.slice(prefix.length) : null;
}

function formatToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatIri(value: string): string {
  const decoded = decodeURIComponent(value);
  const token = decoded.split(/[:/#]/).filter(Boolean).at(-1) ?? decoded;

  return formatToken(token);
}

function formatDemoClock(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatWallClock(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

function getEventOutcome(event: LogisticsEvent): string {
  return event.eventName || formatToken(event.eventCode);
}

function getActionTitle(action: LogisticsAction): string {
  return (
    readIdentifierValue(action.otherIdentifiers, "actionLabel:") ??
    "Supervisor response"
  );
}

function getActionOutcome(action: LogisticsAction): string {
  const outcome = readIdentifierValue(action.otherIdentifiers, "outcome:");

  if (outcome) {
    return formatToken(outcome);
  }

  return action.actionEndTime ? "Completed" : "Open";
}

function getLoadingOutcome(loading: Loading): string {
  const unitLabel = `${loading.loadedUnits.length} unit${loading.loadedUnits.length === 1 ? "" : "s"}`;
  const pieceLabel = `${loading.loadedPieces.length} piece${loading.loadedPieces.length === 1 ? "" : "s"}`;

  return `${unitLabel} loaded · ${pieceLabel}`;
}

function buildTimelineEntries(
  events: LogisticsEvent[],
  actions: LogisticsAction[],
  loadings: Loading[],
): TimelineEntry[] {
  const eventEntries = events.map((event) => ({
    id: String(event["@id"]),
    kind: "event" as const,
    location: formatIri(String(event.eventLocation)),
    outcome: getEventOutcome(event),
    timestamp: event.eventDate,
    title: formatToken(event.eventCode),
  }));
  const actionEntries = actions.map((action) => ({
    id: String(action["@id"]),
    kind: "action" as const,
    location: formatIri(String(action.performedAt)),
    outcome: getActionOutcome(action),
    timestamp: action.actionStartTime,
    title: getActionTitle(action),
  }));
  const loadingEntries = loadings.map((loading) => ({
    id: String(loading["@id"]),
    kind: "loading" as const,
    location: formatIri(String(loading.performedAt)),
    outcome: getLoadingOutcome(loading),
    timestamp: loading.actionStartTime,
    title: formatToken(loading.loadingType),
  }));

  return [...eventEntries, ...actionEntries, ...loadingEntries].sort(
    (left, right) => {
      const timestampCompare = left.timestamp.localeCompare(right.timestamp);

      if (timestampCompare !== 0) {
        return timestampCompare;
      }

      return left.id.localeCompare(right.id);
    },
  );
}

function getKindLabel(kind: TimelineEntry["kind"]): string {
  if (kind === "event") {
    return "Event";
  }

  if (kind === "action") {
    return "Action";
  }

  return "Loading";
}

function getKindIcon(kind: TimelineEntry["kind"]) {
  if (kind === "event") {
    return AlertTriangle;
  }

  if (kind === "action") {
    return Wrench;
  }

  return Package;
}

function getKindClasses(kind: TimelineEntry["kind"]): string {
  if (kind === "event") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (kind === "action") {
    return "border-primary/40 bg-primary/10 text-primary";
  }

  return "border-secondary bg-secondary/80 text-secondary-foreground";
}

export function AuditTimeline({ actions, events, loadings }: Props) {
  const entries = buildTimelineEntries(events, actions, loadings);

  if (entries.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center border border-dashed border-border bg-background/40 px-4">
        <p className="text-sm text-muted-foreground">
          No audit events, actions, or loadings recorded.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, index) => {
        const Icon = getKindIcon(entry.kind);

        return (
          <li
            key={entry.id}
            className="grid grid-cols-[minmax(0,8rem)_2.5rem_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[minmax(0,11rem)_3rem_minmax(0,1fr)] sm:gap-4"
          >
            <div className="flex min-w-0 flex-col gap-1 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Demo clock
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatDemoClock(entry.timestamp)} UTC
              </p>
              <p className="text-xs text-muted-foreground">
                {formatWallClock(entry.timestamp)}
              </p>
            </div>

            <div className="relative flex justify-center">
              {index < entries.length - 1 ? (
                <span className="absolute left-1/2 top-10 bottom-[-1rem] w-px -translate-x-1/2 bg-border" />
              ) : null}
              <span
                className={cn(
                  "relative mt-1 flex size-8 items-center justify-center rounded-full border shadow-sm",
                  getKindClasses(entry.kind),
                )}
              >
                <Icon aria-hidden="true" />
              </span>
            </div>

            <Card className="border-border/80 bg-card/70">
              <CardHeader className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{getKindLabel(entry.kind)}</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base text-foreground">
                    {entry.title}
                  </CardTitle>
                  <CardDescription>{entry.location}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm text-foreground">{entry.location}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Outcome
                  </p>
                  <p className="text-sm text-foreground">{entry.outcome}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
