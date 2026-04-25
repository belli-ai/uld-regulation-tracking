'use client';

import Link from 'next/link';

import { TableCell, TableRow } from '@/components/ui/table';
import type { ResolutionOutcome } from '@/lib/audit/resolution-logger';
import type { LogisticsAction, LogisticsEvent } from '@/lib/ontology/one-record';
import { cn } from '@/lib/utils';

type Props = {
  action: LogisticsAction;
  actionLabel: string;
  actionRef: string;
  category: string;
  claimedBenefitHours: number | null;
  executor: string | null;
  isSelected?: boolean;
  linkedExcursion: LogisticsEvent | null;
  measuredBenefitHours: number | null;
  outcome: ResolutionOutcome | 'unknown';
  shc: string;
  stationCapability: string | null;
  uldId: string;
};

function formatDateTime(timestamp: string): string {
  const value = new Date(timestamp);

  if (Number.isNaN(value.getTime())) {
    return 'Invalid time';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function formatBenefit(value: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(1)} h` : '—';
}

function getOutcomeMeta(outcome: ResolutionOutcome | 'unknown'): {
  badgeClassName: string;
  label: string;
} {
  if (outcome === 'averted') {
    return {
      badgeClassName: 'bg-primary/10 text-primary',
      label: 'Averted',
    };
  }

  if (outcome === 'monitoring') {
    return {
      badgeClassName: 'bg-orange-500/10 text-orange-500',
      label: 'Monitoring',
    };
  }

  if (outcome === 'cancelled') {
    return {
      badgeClassName: 'bg-muted text-muted-foreground',
      label: 'Cancelled',
    };
  }

  if (outcome === 'breached-anyway') {
    return {
      badgeClassName: 'bg-destructive/10 text-destructive',
      label: 'Breached anyway',
    };
  }

  return {
    badgeClassName: 'bg-secondary text-secondary-foreground',
    label: 'Unknown',
  };
}

function ShcBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
      {code}
    </span>
  );
}

export function ResolutionLogRow({
  action,
  actionLabel,
  actionRef,
  category,
  claimedBenefitHours,
  executor,
  isSelected = false,
  linkedExcursion,
  measuredBenefitHours,
  outcome,
  shc,
  stationCapability,
  uldId,
}: Props) {
  const outcomeMeta = getOutcomeMeta(outcome);

  return (
    <TableRow
      className={cn(
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">
            {formatDateTime(action.actionStartTime)}
          </span>
          <span className="text-xs text-muted-foreground">
            Ends {action.actionEndTime ? formatDateTime(action.actionEndTime) : 'open'}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">{actionLabel}</span>
          <span className="text-xs text-muted-foreground">{actionRef}</span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-foreground">{category}</span>
          <ShcBadge code={shc} />
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <span
            className={cn(
              'inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold',
              outcomeMeta.badgeClassName,
            )}
          >
            {outcomeMeta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {executor ?? 'Executor unknown'}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">
            Claimed {formatBenefit(claimedBenefitHours)}
          </span>
          <span className="text-xs text-muted-foreground">
            Actual {formatBenefit(measuredBenefitHours)}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">{uldId}</span>
          <span className="text-xs text-muted-foreground">
            {stationCapability ?? String(action.performedAt)}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        {linkedExcursion ? (
          <Link
            href={`/supervisor/excursions?excursion=${encodeURIComponent(
              String(linkedExcursion['@id']),
            )}`}
            className="flex flex-col gap-1 text-sm text-primary transition-colors hover:text-accent"
          >
            <span>{linkedExcursion.eventName}</span>
            <span className="text-xs text-muted-foreground">
              {linkedExcursion.eventCode}
            </span>
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">No linked excursion</span>
        )}
      </TableCell>
    </TableRow>
  );
}
