'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ExcursionLogRow } from '@/components/excursion-log-row';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LogisticsAction, LogisticsEvent } from '@/lib/ontology/one-record';
import { auditDb } from '@/lib/persistence/audit-db';
import { cn } from '@/lib/utils';

const EXCURSION_EVENT_CODES = [
  'WARNING_BUDGET_LOW',
  'BREACH_PREDICTED',
  'BREACH_ACTUAL',
] as const;

type ExcursionEventCode = (typeof EXCURSION_EVENT_CODES)[number];

type ExtendedExcursionEvent = LogisticsEvent & {
  ambientTemperatureC?: number;
  flightId?: string;
  internalTemperatureC?: number;
  otherIdentifiers?: string[];
  predictedBreachInMinutes?: number | null;
  rootCause?: string;
  shc?: string;
  state?: string;
};

type ExcursionRowData = {
  ambientTemperatureC: number | null;
  event: LogisticsEvent;
  internalTemperatureC: number | null;
  linkedResolution: LogisticsAction | null;
  predictedBreachInMinutes: number | null;
  rootCause: string | null;
  shc: string;
  state: string;
};

type SeverityFilter = 'all' | ExcursionEventCode;

const filterClassName =
  'h-11 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function readIdentifierValue(
  identifiers: string[] | undefined,
  prefix: string,
): string | null {
  const match = identifiers?.find((identifier) => identifier.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function readNumberValue(
  identifiers: string[] | undefined,
  prefix: string,
): number | null {
  const value = readIdentifierValue(identifiers, prefix);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function getEventIdentifiers(event: LogisticsEvent): string[] | undefined {
  return (event as ExtendedExcursionEvent).otherIdentifiers;
}

function getEventShc(event: LogisticsEvent): string {
  const extendedEvent = event as ExtendedExcursionEvent;
  const shcFromIdentifiers = readIdentifierValue(getEventIdentifiers(event), 'shc:');

  return extendedEvent.shc ?? shcFromIdentifiers ?? 'Unknown';
}

function getEventState(event: LogisticsEvent): string {
  const extendedEvent = event as ExtendedExcursionEvent;
  const stateFromIdentifiers = readIdentifierValue(
    getEventIdentifiers(event),
    'state:',
  );

  return extendedEvent.state ?? stateFromIdentifiers ?? 'Unknown';
}

function getAmbientTemperature(event: LogisticsEvent): number | null {
  const extendedEvent = event as ExtendedExcursionEvent;

  if (typeof extendedEvent.ambientTemperatureC === 'number') {
    return extendedEvent.ambientTemperatureC;
  }

  return readNumberValue(getEventIdentifiers(event), 'ambientTemperatureC:');
}

function getInternalTemperature(event: LogisticsEvent): number | null {
  const extendedEvent = event as ExtendedExcursionEvent;

  if (typeof extendedEvent.internalTemperatureC === 'number') {
    return extendedEvent.internalTemperatureC;
  }

  return readNumberValue(getEventIdentifiers(event), 'internalTemperatureC:');
}

function getPredictedBreachInMinutes(event: LogisticsEvent): number | null {
  const extendedEvent = event as ExtendedExcursionEvent;

  if (typeof extendedEvent.predictedBreachInMinutes === 'number') {
    return extendedEvent.predictedBreachInMinutes;
  }

  return readNumberValue(getEventIdentifiers(event), 'predictedBreachInMinutes:');
}

function getRootCause(event: LogisticsEvent): string | null {
  const extendedEvent = event as ExtendedExcursionEvent;

  return (
    extendedEvent.rootCause ??
    readIdentifierValue(getEventIdentifiers(event), 'rootCause:')
  );
}

function getResolutionTimestamp(action: LogisticsAction): string {
  return action.actionStartTime;
}

function getSeverityCounts(events: ExcursionRowData[]): Record<ExcursionEventCode, number> {
  return events.reduce<Record<ExcursionEventCode, number>>(
    (counts, row) => {
      if (row.event.eventCode === 'WARNING_BUDGET_LOW') {
        counts.WARNING_BUDGET_LOW += 1;
      }

      if (row.event.eventCode === 'BREACH_PREDICTED') {
        counts.BREACH_PREDICTED += 1;
      }

      if (row.event.eventCode === 'BREACH_ACTUAL') {
        counts.BREACH_ACTUAL += 1;
      }

      return counts;
    },
    {
      WARNING_BUDGET_LOW: 0,
      BREACH_PREDICTED: 0,
      BREACH_ACTUAL: 0,
    },
  );
}

function getDateValue(value: string): string {
  return value.slice(0, 10);
}

async function loadExcursionEvents(): Promise<LogisticsEvent[]> {
  const eventsTable = auditDb.events as unknown as {
    toCollection(): {
      and(
        predicate: (event: LogisticsEvent) => boolean,
      ): { toArray(): Promise<LogisticsEvent[]> };
    };
    where(index: string): {
      equals(value: string): {
        and(
          predicate: (event: LogisticsEvent) => boolean,
        ): { toArray(): Promise<LogisticsEvent[]> };
      };
    };
  };

  try {
    return await eventsTable
      .where('@type')
      .equals('LogisticsEvent')
      .and((event) =>
        EXCURSION_EVENT_CODES.includes(event.eventCode as ExcursionEventCode),
      )
      .toArray();
  } catch {
    return eventsTable
      .toCollection()
      .and(
        (event) =>
          event['@type'] === 'LogisticsEvent' &&
          EXCURSION_EVENT_CODES.includes(event.eventCode as ExcursionEventCode),
      )
      .toArray();
  }
}

function getSelectedExcursionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('excursion');
}

export default function SupervisorExcursionsPage() {
  const [rows, setRows] = useState<ExcursionRowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uldFilter, setUldFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [shcFilter, setShcFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selectedExcursionId, setSelectedExcursionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      const [events, actions] = await Promise.all([
        loadExcursionEvents(),
        auditDb.actions.toArray(),
      ]);
      const firstResolutionByEventId = new Map<string, LogisticsAction>();

      actions
        .slice()
        .sort((left, right) =>
          getResolutionTimestamp(left).localeCompare(getResolutionTimestamp(right)),
        )
        .forEach((action) => {
          if (!action.servedActivity) {
            return;
          }

          const key = String(action.servedActivity);

          if (!firstResolutionByEventId.has(key)) {
            firstResolutionByEventId.set(key, action);
          }
        });

      const nextRows = events
        .slice()
        .sort((left, right) => right.eventDate.localeCompare(left.eventDate))
        .map<ExcursionRowData>((event) => ({
          ambientTemperatureC: getAmbientTemperature(event),
          event,
          internalTemperatureC: getInternalTemperature(event),
          linkedResolution: firstResolutionByEventId.get(String(event['@id'])) ?? null,
          predictedBreachInMinutes: getPredictedBreachInMinutes(event),
          rootCause: getRootCause(event),
          shc: getEventShc(event),
          state: getEventState(event),
        }));

      if (!cancelled) {
        setRows(nextRows);
        setIsLoading(false);
        setSelectedExcursionId(getSelectedExcursionId());
      }
    }

    void loadRows();

    const intervalId = window.setInterval(() => {
      void loadRows();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredRows = rows.filter((row) => {
    const uldMatches =
      uldFilter === 'all' || String(row.event.eventFor) === uldFilter;
    const shcMatches = shcFilter === 'all' || row.shc === shcFilter;
    const severityMatches =
      severityFilter === 'all' || row.event.eventCode === severityFilter;
    const eventDate = getDateValue(row.event.eventDate);
    const startMatches = !startDateFilter || eventDate >= startDateFilter;
    const endMatches = !endDateFilter || eventDate <= endDateFilter;

    return uldMatches && shcMatches && severityMatches && startMatches && endMatches;
  });
  const severityCounts = getSeverityCounts(filteredRows);
  const resolvedCount = filteredRows.filter((row) => row.linkedResolution).length;
  const uldOptions = Array.from(
    new Set(rows.map((row) => String(row.event.eventFor))),
  ).sort((left, right) => left.localeCompare(right));
  const shcOptions = Array.from(new Set(rows.map((row) => row.shc))).sort(
    (left, right) => left.localeCompare(right),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-base font-semibold text-foreground">
              Excursion Log
            </h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/supervisor/excursions"
              className="text-foreground transition-colors hover:text-primary"
            >
              Excursions
            </Link>
            <Link
              href="/supervisor/resolutions"
              className="transition-colors hover:text-primary"
            >
              Resolutions
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Supervisor
          </p>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-foreground">
              Predicted and actual excursion events
            </h2>
            <p className="text-base text-muted-foreground">
              Warning, breach-predicted, and actual excursion events pulled from
              the audit database.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-1">
              <CardDescription>Total events</CardDescription>
              <CardTitle className="text-7xl font-bold tracking-tighter">
                {filteredRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-1">
              <CardDescription>Warning / predicted</CardDescription>
              <CardTitle className="text-2xl">
                {severityCounts.WARNING_BUDGET_LOW} /{' '}
                {severityCounts.BREACH_PREDICTED}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-1">
              <CardDescription>Linked resolutions</CardDescription>
              <CardTitle className="text-2xl">
                {resolvedCount}/{filteredRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-lg font-semibold leading-none">
              Filters
            </CardTitle>
            <CardDescription>
              Narrow by ULD, date, SHC, and event severity.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>ULD</span>
              <select
                value={uldFilter}
                onChange={(event) => setUldFilter(event.target.value)}
                className={filterClassName}
              >
                <option value="all">All ULDs</option>
                {uldOptions.map((uldId) => (
                  <option key={uldId} value={uldId}>
                    {uldId}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Start date</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(event) => setStartDateFilter(event.target.value)}
                className={filterClassName}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>End date</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(event) => setEndDateFilter(event.target.value)}
                className={filterClassName}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>SHC</span>
              <select
                value={shcFilter}
                onChange={(event) => setShcFilter(event.target.value)}
                className={filterClassName}
              >
                <option value="all">All SHC</option>
                {shcOptions.map((shc) => (
                  <option key={shc} value={shc}>
                    {shc}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Severity</span>
              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as SeverityFilter)
                }
                className={filterClassName}
              >
                <option value="all">All severities</option>
                <option value="WARNING_BUDGET_LOW">Warning</option>
                <option value="BREACH_PREDICTED">Alert</option>
                <option value="BREACH_ACTUAL">Excursion</option>
              </select>
            </label>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-lg font-semibold leading-none">
              Event list
            </CardTitle>
            <CardDescription>
              Audit events refresh every five seconds while this page is open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                {isLoading
                  ? 'Loading excursion events from IndexedDB.'
                  : `${filteredRows.length} excursion events in view.`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>ULD</TableHead>
                  <TableHead>SHC</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Thermal</TableHead>
                  <TableHead>Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <ExcursionLogRow
                    key={row.event['@id']}
                    event={row.event}
                    ambientTemperatureC={row.ambientTemperatureC}
                    internalTemperatureC={row.internalTemperatureC}
                    linkedResolution={row.linkedResolution}
                    predictedBreachInMinutes={row.predictedBreachInMinutes}
                    rootCause={row.rootCause}
                    shc={row.shc}
                    state={row.state}
                    isSelected={selectedExcursionId === String(row.event['@id'])}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 ? (
                  <TableRow>
                    <td
                      colSpan={7}
                      className={cn(
                        'p-6 text-center text-base text-muted-foreground',
                      )}
                    >
                      No excursion events match the current filters.
                    </td>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
