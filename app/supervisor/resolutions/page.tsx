'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BenefitScatterChart } from '@/components/benefit-scatter-chart';
import { ResolutionLogRow } from '@/components/resolution-log-row';
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
import type { ResolutionOutcome } from '@/lib/audit/resolution-logger';
import type { LogisticsAction, LogisticsEvent } from '@/lib/ontology/one-record';
import { auditDb } from '@/lib/persistence/audit-db';
import { ACTION_LIBRARY } from '@/lib/recommender/action-library';
import { cn } from '@/lib/utils';

type OutcomeFilter = 'all' | ResolutionOutcome | 'unknown';

type ExtendedExcursionEvent = LogisticsEvent & {
  otherIdentifiers?: string[];
  shc?: string;
};

type ResolutionRowData = {
  action: LogisticsAction;
  actionLabel: string;
  actionRef: string;
  category: string;
  claimedBenefitHours: number | null;
  executor: string | null;
  linkedExcursion: LogisticsEvent | null;
  measuredBenefitHours: number | null;
  outcome: ResolutionOutcome | 'unknown';
  shc: string;
  stationCapability: string | null;
  uldId: string;
};

type BenefitPoint = {
  actionLabel: string;
  category: string;
  claimedBenefitHours: number;
  measuredBenefitHours: number;
};

const filterClassName =
  'h-11 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const outcomeColors = [
  'var(--primary)',
  'var(--accent)',
  'var(--muted-foreground)',
  'var(--destructive)',
  'var(--border)',
];

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

function getEventShc(event: LogisticsEvent | null): string {
  if (!event) {
    return 'Unknown';
  }

  const extendedEvent = event as ExtendedExcursionEvent;
  const shcFromIdentifiers = readIdentifierValue(getEventIdentifiers(event), 'shc:');

  return extendedEvent.shc ?? shcFromIdentifiers ?? 'Unknown';
}

function getActionReference(action: LogisticsAction): string | null {
  return readIdentifierValue(action.otherIdentifiers, 'actionRef:');
}

function getActionLabel(action: LogisticsAction): string {
  return (
    readIdentifierValue(action.otherIdentifiers, 'actionLabel:') ?? 'Unspecified action'
  );
}

function getExecutor(action: LogisticsAction): string | null {
  return readIdentifierValue(action.otherIdentifiers, 'executor:');
}

function getOutcome(action: LogisticsAction): ResolutionOutcome | 'unknown' {
  const outcome = readIdentifierValue(action.otherIdentifiers, 'outcome:');

  if (
    outcome === 'averted' ||
    outcome === 'breached-anyway' ||
    outcome === 'monitoring' ||
    outcome === 'cancelled'
  ) {
    return outcome;
  }

  return 'unknown';
}

function getSelectedResolutionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('resolution');
}

export default function SupervisorResolutionsPage() {
  const [rows, setRows] = useState<ResolutionRowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [selectedResolutionId, setSelectedResolutionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      const [actions, events] = await Promise.all([
        auditDb.actions.toArray(),
        auditDb.events.toArray(),
      ]);
      const eventById = new Map(events.map((event) => [String(event['@id']), event]));
      const actionDefinitions = new Map(
        ACTION_LIBRARY.map((actionDefinition) => [actionDefinition.id, actionDefinition]),
      );
      const nextRows = actions
        .map<ResolutionRowData | null>((action) => {
          const actionRef = getActionReference(action);

          if (!actionRef) {
            return null;
          }

          const definition = actionDefinitions.get(actionRef);

          if (!definition) {
            return null;
          }

          const linkedExcursion = action.servedActivity
            ? eventById.get(String(action.servedActivity)) ?? null
            : null;

          return {
            action,
            actionLabel: getActionLabel(action),
            actionRef,
            category: definition.category,
            claimedBenefitHours: readNumberValue(
              action.otherIdentifiers,
              'claimedBenefitHours:',
            ),
            executor: getExecutor(action),
            linkedExcursion,
            measuredBenefitHours: readNumberValue(
              action.otherIdentifiers,
              'measuredBenefitHours:',
            ),
            outcome: getOutcome(action),
            shc: getEventShc(linkedExcursion),
            stationCapability: readIdentifierValue(
              action.otherIdentifiers,
              'stationCapability:',
            ),
            uldId: linkedExcursion ? String(linkedExcursion.eventFor) : 'Unknown',
          };
        })
        .filter((row): row is ResolutionRowData => row !== null)
        .sort((left, right) =>
          right.action.actionStartTime.localeCompare(left.action.actionStartTime),
        );

      if (!cancelled) {
        setRows(nextRows);
        setIsLoading(false);
        setSelectedResolutionId(getSelectedResolutionId());
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
    const categoryMatches =
      categoryFilter === 'all' || row.category === categoryFilter;
    const outcomeMatches =
      outcomeFilter === 'all' || row.outcome === outcomeFilter;

    return categoryMatches && outcomeMatches;
  });
  const categoryOptions = Array.from(new Set(rows.map((row) => row.category))).sort(
    (left, right) => left.localeCompare(right),
  );
  const pieData = [
    {
      count: filteredRows.filter((row) => row.outcome === 'averted').length,
      name: 'Averted',
    },
    {
      count: filteredRows.filter((row) => row.outcome === 'breached-anyway').length,
      name: 'Breached anyway',
    },
    {
      count: filteredRows.filter((row) => row.outcome === 'monitoring').length,
      name: 'Monitoring',
    },
    {
      count: filteredRows.filter((row) => row.outcome === 'cancelled').length,
      name: 'Cancelled',
    },
    {
      count: filteredRows.filter((row) => row.outcome === 'unknown').length,
      name: 'Unknown',
    },
  ].filter((entry) => entry.count > 0);
  const actionFrequencyData = Array.from(
    filteredRows.reduce<Map<string, number>>((counts, row) => {
      counts.set(row.actionLabel, (counts.get(row.actionLabel) ?? 0) + 1);

      return counts;
    }, new Map()),
  )
    .map(([actionLabel, count]) => ({ actionLabel, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const benefitData = filteredRows
    .filter(
      (row) =>
        typeof row.claimedBenefitHours === 'number' &&
        typeof row.measuredBenefitHours === 'number',
    )
    .map<BenefitPoint>((row) => ({
      actionLabel: row.actionLabel,
      category: row.category,
      claimedBenefitHours: row.claimedBenefitHours as number,
      measuredBenefitHours: row.measuredBenefitHours as number,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-base font-semibold text-foreground">
              Resolution Log
            </h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/supervisor/excursions"
              className="transition-colors hover:text-primary"
            >
              Excursions
            </Link>
            <Link
              href="/supervisor/resolutions"
              className="text-foreground transition-colors hover:text-primary"
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
              Resolution history and benefit calibration
            </h2>
            <p className="text-base text-muted-foreground">
              Action records filtered to known library references, with outcome
              and benefit aggregates.
            </p>
          </div>
        </section>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-lg font-semibold leading-none">
              Filters
            </CardTitle>
            <CardDescription>
              Narrow by action category and recorded outcome.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Action category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={filterClassName}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Outcome</span>
              <select
                value={outcomeFilter}
                onChange={(event) =>
                  setOutcomeFilter(event.target.value as OutcomeFilter)
                }
                className={filterClassName}
              >
                <option value="all">All outcomes</option>
                <option value="averted">Averted</option>
                <option value="breached-anyway">Breached anyway</option>
                <option value="monitoring">Monitoring</option>
                <option value="cancelled">Cancelled</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="text-lg font-semibold leading-none">
                Outcome mix
              </CardTitle>
              <CardDescription>How filtered resolutions ended.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={outcomeColors[index % outcomeColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        color: 'var(--foreground)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  No outcome data for the active filters.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="text-lg font-semibold leading-none">
                Most-used actions
              </CardTitle>
              <CardDescription>
                Frequency of action labels in the filtered set.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {actionFrequencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionFrequencyData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="actionLabel"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      interval={0}
                      angle={-18}
                      height={64}
                      textAnchor="end"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        color: 'var(--foreground)',
                      }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  No action-frequency data for the active filters.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="text-lg font-semibold leading-none">
                Claimed vs actual benefit
              </CardTitle>
              <CardDescription>
                Scatter plot for actions with both values recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <BenefitScatterChart points={benefitData} />
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-lg font-semibold leading-none">
              Resolution list
            </CardTitle>
            <CardDescription>
              Actions refresh every five seconds while this page is open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                {isLoading
                  ? 'Loading resolution actions from IndexedDB.'
                  : `${filteredRows.length} resolution actions in view.`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Benefit</TableHead>
                  <TableHead>ULD</TableHead>
                  <TableHead>Excursion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <ResolutionLogRow
                    key={row.action['@id']}
                    action={row.action}
                    actionLabel={row.actionLabel}
                    actionRef={row.actionRef}
                    category={row.category}
                    claimedBenefitHours={row.claimedBenefitHours}
                    executor={row.executor}
                    linkedExcursion={row.linkedExcursion}
                    measuredBenefitHours={row.measuredBenefitHours}
                    outcome={row.outcome}
                    shc={row.shc}
                    stationCapability={row.stationCapability}
                    uldId={row.uldId}
                    isSelected={selectedResolutionId === String(row.action['@id'])}
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
                      No resolution actions match the current filters.
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
