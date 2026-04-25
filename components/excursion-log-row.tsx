'use client';

import Link from 'next/link';

import { TableCell, TableRow } from '@/components/ui/table';
import type { LogisticsAction, LogisticsEvent } from '@/lib/ontology/one-record';
import { cn } from '@/lib/utils';

type Props = {
  ambientTemperatureC: number | null;
  event: LogisticsEvent;
  internalTemperatureC: number | null;
  isSelected?: boolean;
  linkedResolution: LogisticsAction | null;
  predictedBreachInMinutes: number | null;
  rootCause: string | null;
  shc: string;
  state: string;
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

function formatTemperature(value: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(1)}°C` : '—';
}

function formatPrediction(value: number | null): string {
  return typeof value === 'number' ? `${Math.round(value)} min` : '—';
}

function getSeverityMeta(eventCode: string): {
  badgeClassName: string;
  label: string;
} {
  if (eventCode === 'WARNING_BUDGET_LOW') {
    return {
      badgeClassName: 'bg-orange-500/10 text-orange-500',
      label: 'Warning',
    };
  }

  if (eventCode === 'BREACH_PREDICTED') {
    return {
      badgeClassName: 'bg-primary/10 text-primary',
      label: 'Alert',
    };
  }

  return {
    badgeClassName: 'bg-destructive/10 text-destructive',
    label: 'Excursion',
  };
}

function readIdentifierValue(
  identifiers: string[] | undefined,
  prefix: string,
): string | null {
  const match = identifiers?.find((identifier) => identifier.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function getResolutionLabel(action: LogisticsAction | null): string {
  if (!action) {
    return 'Unresolved';
  }

  return (
    readIdentifierValue(action.otherIdentifiers, 'actionLabel:') ??
    readIdentifierValue(action.otherIdentifiers, 'actionRef:') ??
    String(action['@id'])
  );
}

function ShcBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
      {code}
    </span>
  );
}

export function ExcursionLogRow({
  event,
  ambientTemperatureC,
  internalTemperatureC,
  isSelected = false,
  linkedResolution,
  predictedBreachInMinutes,
  rootCause,
  shc,
  state,
}: Props) {
  const severity = getSeverityMeta(event.eventCode);

  return (
    <TableRow
      className={cn(
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">
            {formatDateTime(event.eventDate)}
          </span>
          <span className="text-xs text-muted-foreground">{event.eventName}</span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <span
            className={cn(
              'inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold',
              severity.badgeClassName,
            )}
          >
            {severity.label}
          </span>
          <span className="text-xs text-muted-foreground">{event.eventCode}</span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">{String(event.eventFor)}</span>
          <span className="text-xs text-muted-foreground">
            {String(event.eventLocation)}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <ShcBadge code={shc} />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">{state}</span>
          <span className="text-xs text-muted-foreground">
            {rootCause ?? 'Root cause pending'}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">
            In {formatTemperature(internalTemperatureC)} / Amb{' '}
            {formatTemperature(ambientTemperatureC)}
          </span>
          <span className="text-xs text-muted-foreground">
            Predicted breach {formatPrediction(predictedBreachInMinutes)}
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        {linkedResolution ? (
          <Link
            href={`/supervisor/resolutions?resolution=${encodeURIComponent(
              String(linkedResolution['@id']),
            )}`}
            className="flex flex-col gap-1 text-sm text-primary transition-colors hover:text-accent"
          >
            <span>{getResolutionLabel(linkedResolution)}</span>
            <span className="text-xs text-muted-foreground">
              Starts {formatDateTime(linkedResolution.actionStartTime)}
            </span>
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">No linked resolution</span>
        )}
      </TableCell>
    </TableRow>
  );
}
