'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type TrackerStage =
  | 'in-warehouse'
  | 'in-tarmac'
  | 'in-flight'
  | 'arrived-tarmac'
  | 'arrived-destination';

export type TrackerStatus = 'OK' | 'Alert' | 'Action in progress' | 'Excursion';

export type UldTrackerRow = {
  ambientC: number;
  budgetRemainingHours: number;
  budgetRemainingPercent: number;
  budgetState: 'green' | 'yellow' | 'red';
  flightNumber: string | null;
  flightTimeLabel: string;
  internalC: number;
  shcCode: string;
  stage: TrackerStage;
  stageLabel: string;
  status: TrackerStatus;
  typeCode: string;
  typeLabel: string;
  uldId: string;
};

type SortKey =
  | 'ambientC'
  | 'budgetRemainingHours'
  | 'flightNumber'
  | 'internalC'
  | 'shcCode'
  | 'stageLabel'
  | 'status'
  | 'typeCode'
  | 'uldId';

type SortState = {
  direction: 'asc' | 'desc';
  key: SortKey;
};

type Props = {
  rows: UldTrackerRow[];
};

function InlineShcBadge({ code }: { code: string }) {
  const className =
    code === 'AVI' || code === 'HEG'
      ? 'border-red-500/30 bg-red-500/10 text-red-400'
      : code === 'PER'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : code === 'COL'
          ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
          : code === 'CRT'
            ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
            : code === 'FRO'
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
              : 'border-border bg-muted text-muted-foreground';

  return (
    <Badge variant="outline" className={cn('font-mono text-xs font-semibold', className)}>
      {code}
    </Badge>
  );
}

function InlineThermalBudgetBar({
  hours,
  percent,
  state,
}: {
  hours: number;
  percent: number;
  state: UldTrackerRow['budgetState'];
}) {
  const fillClassName =
    state === 'green'
      ? 'bg-emerald-500'
      : state === 'yellow'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="flex min-w-[140px] flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">
          {hours.toFixed(1)}h
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full transition-all', fillClassName)}
          style={{ width: `${Math.max(6, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function getStatusClassName(status: TrackerStatus): string {
  switch (status) {
    case 'OK':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'Alert':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'Action in progress':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    case 'Excursion':
      return 'border-red-500/30 bg-red-500/10 text-red-400';
  }
}

function getRowClassName(status: TrackerStatus): string {
  switch (status) {
    case 'OK':
      return 'hover:bg-emerald-500/5';
    case 'Alert':
      return 'hover:bg-amber-500/5';
    case 'Action in progress':
      return 'hover:bg-sky-500/5';
    case 'Excursion':
      return 'hover:bg-red-500/5';
  }
}

function compareRows(left: UldTrackerRow, right: UldTrackerRow, sort: SortState): number {
  const leftValue = left[sort.key];
  const rightValue = right[sort.key];

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return sort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
  }

  const normalizedLeft = String(leftValue ?? '');
  const normalizedRight = String(rightValue ?? '');
  const result = normalizedLeft.localeCompare(normalizedRight);

  return sort.direction === 'asc' ? result : -result;
}

export function UldTrackerTable({ rows }: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({
    direction: 'asc',
    key: 'budgetRemainingHours',
  });

  const sortedRows = [...rows].sort((left, right) => compareRows(left, right, sort));

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return {
          direction: current.direction === 'asc' ? 'desc' : 'asc',
          key,
        };
      }

      return {
        direction: key === 'budgetRemainingHours' ? 'asc' : 'desc',
        key,
      };
    });
  }

  function renderSortIcon(key: SortKey) {
    if (sort.key !== key) {
      return <ArrowDown className="size-3.5 opacity-35" />;
    }

    return sort.direction === 'asc' ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('uldId')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              ULD ID
              {renderSortIcon('uldId')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('typeCode')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Type
              {renderSortIcon('typeCode')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('shcCode')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              SHC
              {renderSortIcon('shcCode')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('stageLabel')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Stage
              {renderSortIcon('stageLabel')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('internalC')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Internal
              {renderSortIcon('internalC')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('ambientC')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Ambient
              {renderSortIcon('ambientC')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('budgetRemainingHours')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Budget
              {renderSortIcon('budgetRemainingHours')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('flightNumber')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Outbound
              {renderSortIcon('flightNumber')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => toggleSort('status')}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              Status
              {renderSortIcon('status')}
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.length > 0 ? (
          sortedRows.map((row) => (
            <TableRow
              key={row.uldId}
              onClick={() => router.push(`/uld/${row.uldId}`)}
              className={cn(
                'cursor-pointer border-border transition-colors',
                'focus-visible:border-ring focus-visible:outline-none',
                getRowClassName(row.status),
              )}
            >
              <TableCell className="font-mono text-sm font-semibold text-foreground">
                {row.uldId}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {row.typeCode}
                  </span>
                  <span className="text-xs text-muted-foreground">{row.typeLabel}</span>
                </div>
              </TableCell>
              <TableCell>
                <InlineShcBadge code={row.shcCode} />
              </TableCell>
              <TableCell className="text-sm text-foreground">{row.stageLabel}</TableCell>
              <TableCell className="font-mono text-sm text-foreground">
                {row.internalC.toFixed(1)}°C
              </TableCell>
              <TableCell className="font-mono text-sm text-foreground">
                {row.ambientC.toFixed(1)}°C
              </TableCell>
              <TableCell>
                <InlineThermalBudgetBar
                  hours={row.budgetRemainingHours}
                  percent={row.budgetRemainingPercent}
                  state={row.budgetState}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {row.flightNumber ?? 'Unassigned'}
                  </span>
                  <span className="text-xs text-muted-foreground">ETD {row.flightTimeLabel}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('font-mono text-xs font-semibold', getStatusClassName(row.status))}
                >
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={9} className="py-10 text-center text-base text-muted-foreground">
              No built ULDs available for the supervisor dashboard.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
