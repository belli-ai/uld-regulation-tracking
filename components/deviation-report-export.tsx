'use client';

import { Download, FileCode2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from '@/lib/ontology/one-record';

type Props = {
  actions: LogisticsAction[];
  events: LogisticsEvent[];
  loadings: Loading[];
  markdown: string;
  uldId: string;
};

type JsonLdBundle = {
  '@context': {
    '@vocab': string;
    generatedAt: string;
    uldId: string;
  };
  '@graph': Array<Loading | LogisticsAction | LogisticsEvent>;
  '@id': string;
  '@type': 'Dataset';
  generatedAt: string;
  uldId: string;
};

function toSafeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]+/g, '-');
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildAuditBundle(
  uldId: string,
  events: LogisticsEvent[],
  actions: LogisticsAction[],
  loadings: Loading[],
): JsonLdBundle {
  return {
    '@context': {
      '@vocab': 'https://onerecord.iata.org/ns/cargo#',
      generatedAt: 'http://schema.org/dateCreated',
      uldId: '@id',
    },
    '@graph': [...events, ...actions, ...loadings],
    '@id': `urn:cool-chain:audit-bundle:${encodeURIComponent(uldId)}`,
    '@type': 'Dataset',
    generatedAt: new Date().toISOString(),
    uldId,
  };
}

export function DeviationReportExport({
  actions,
  events,
  loadings,
  markdown,
  uldId,
}: Props) {
  const safeUldId = toSafeFilename(uldId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        type="button"
        onClick={() =>
          downloadFile(
            markdown || '# Deviation Report\n\nNo deviation report available for this ULD yet.\n',
            `${safeUldId}-deviation-report.md`,
            'text/markdown',
          )
        }
      >
        <Download data-icon="inline-start" />
        Export deviation report
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          downloadFile(
            JSON.stringify(buildAuditBundle(uldId, events, actions, loadings), null, 2),
            `${safeUldId}-audit-bundle.jsonld`,
            'application/ld+json',
          )
        }
      >
        <FileCode2 data-icon="inline-start" />
        Export full audit bundle
      </Button>
    </div>
  );
}
