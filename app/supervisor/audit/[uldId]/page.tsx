'use client';

import { use, useEffect, useState } from 'react';

import { AuditTimeline } from '@/components/audit-timeline';
import { DeviationReportExport } from '@/components/deviation-report-export';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { deviationReportBuilder } from '@/lib/audit/deviation-report-builder';
import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from '@/lib/ontology/one-record';
import { auditDb } from '@/lib/persistence/audit-db';

type Props = {
  params: Promise<{
    uldId: string;
  }>;
};

type AuditRecords = {
  actions: LogisticsAction[];
  events: LogisticsEvent[];
  loadings: Loading[];
};

function sortByIsoTimestamp<T extends { actionStartTime?: string; eventDate?: string }>(
  values: T[],
): T[] {
  return [...values].sort((left, right) => {
    const leftTimestamp = left.eventDate ?? left.actionStartTime ?? '';
    const rightTimestamp = right.eventDate ?? right.actionStartTime ?? '';

    return leftTimestamp.localeCompare(rightTimestamp);
  });
}

function filterAuditRecords(
  uldId: string,
  events: LogisticsEvent[],
  actions: LogisticsAction[],
  loadings: Loading[],
): AuditRecords {
  const filteredEvents = sortByIsoTimestamp(
    events.filter((event) => String(event.eventFor) === uldId),
  );
  const relatedEventIds = new Set(filteredEvents.map((event) => String(event['@id'])));
  const filteredActions = sortByIsoTimestamp(
    actions.filter((action) => {
      const servedActivity = action.servedActivity ? String(action.servedActivity) : '';

      return servedActivity === uldId || relatedEventIds.has(servedActivity);
    }),
  );
  const filteredLoadings = sortByIsoTimestamp(
    loadings.filter((loading) =>
      loading.loadedUnits.some((loadedUnit) => String(loadedUnit) === uldId),
    ),
  );

  return {
    actions: filteredActions,
    events: filteredEvents,
    loadings: filteredLoadings,
  };
}

export default function AuditPage({ params }: Props) {
  const { uldId: routeUldId } = use(params);
  const uldId = decodeURIComponent(routeUldId);
  const [records, setRecords] = useState<AuditRecords>({
    actions: [],
    events: [],
    loadings: [],
  });
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAuditPage(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [allEvents, allActions, allLoadings, reportMarkdown] = await Promise.all([
          auditDb.events.toArray(),
          auditDb.actions.toArray(),
          auditDb.loadings.toArray(),
          deviationReportBuilder.buildMarkdown(uldId),
        ]);

        if (!active) {
          return;
        }

        setRecords(filterAuditRecords(uldId, allEvents, allActions, allLoadings));
        setMarkdown(reportMarkdown);
      } catch (caughtError) {
        console.error('Failed to load audit timeline', caughtError);

        if (!active) {
          return;
        }

        setError('Unable to load audit records from local storage.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAuditPage();

    return () => {
      active = false;
    };
  }, [uldId]);

  const totalRecords =
    records.events.length + records.actions.length + records.loadings.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-xs font-semibold uppercase tracking-[0.18em]">
              Supervisor audit
            </Badge>
            <Badge variant="secondary" className="text-xs font-semibold">
              {totalRecords} records
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Audit timeline
            </h1>
            <p className="text-base text-muted-foreground">
              Consolidated event, action, and loading history for one ULD.
            </p>
          </div>
          <Card className="border-border/80 bg-card/80">
            <CardHeader className="flex flex-col gap-2 p-5">
              <CardDescription>ULD identifier</CardDescription>
              <CardTitle className="break-all font-mono text-lg text-foreground">
                {uldId}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-card/90">
            <CardHeader className="p-5">
              <CardTitle className="text-lg text-destructive">Audit unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="border-border/80 bg-card/85">
          <CardHeader className="flex flex-col gap-2 p-5">
            <CardTitle className="text-lg text-foreground">Chronological trail</CardTitle>
            <CardDescription>
              Timeline nodes are sorted by event timestamp or action start time.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border bg-background/40 px-4">
                <p className="text-sm text-muted-foreground">Loading audit records…</p>
              </div>
            ) : (
              <AuditTimeline
                actions={records.actions}
                events={records.events}
                loadings={records.loadings}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/85">
          <CardHeader className="flex flex-col gap-2 p-5">
            <CardTitle className="text-lg text-foreground">Deviation report</CardTitle>
            <CardDescription>
              Auto-drafted Markdown generated from the stored audit history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-5 pt-0">
            <DeviationReportExport
              actions={records.actions}
              events={records.events}
              loadings={records.loadings}
              markdown={markdown}
              uldId={uldId}
            />
            <Separator />
            <div className="prose prose-invert max-w-none rounded-lg border border-border bg-background/40 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {markdown || '# Deviation Report\n\nNo deviation report available for this ULD yet.'}
              </pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
