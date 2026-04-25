'use client';

import { useEffect, useState } from 'react';

import shcConfigData from '@/public/config/shc.json';
import stationsConfigData from '@/public/config/stations.json';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { localPrefs } from '@/lib/persistence/local-prefs';
import { cn } from '@/lib/utils';

type TemperatureValue = {
  value: number;
  unit: string;
};

type MaxWaitCurve = {
  ambient25c: number;
  ambient30c?: number;
  ambient35c: number;
  ambient40c: number;
  ambient45c: number;
};

type ShcEntry = {
  label?: string;
  description?: string;
  temperatureInstructions: {
    minTemperature: TemperatureValue;
    maxTemperature: TemperatureValue;
  };
  maxWaitMinutes: MaxWaitCurve;
};

type LoadedShcConfig = {
  shc: Record<string, ShcEntry>;
  default: Record<string, unknown>;
};

type ReloadState = 'idle' | 'loading' | 'success' | 'error';

const ambientColumns = [
  { label: '25°C', key: 'ambient25c' },
  { label: '35°C', key: 'ambient35c' },
  { label: '40°C', key: 'ambient40c' },
  { label: '45°C', key: 'ambient45c' },
] as const;

const dxbStation = stationsConfigData.DXB;
const stationEntries = [
  { key: 'iata', value: dxbStation.iata },
  { key: 'name', value: dxbStation.name },
  { key: 'ceivCertified', value: dxbStation.ceivCertified ? 'Yes' : 'No' },
  {
    key: 'resources.coolDolliesTotal',
    value: String(dxbStation.resources.coolDolliesTotal),
  },
  {
    key: 'resources.coolRoomSlotsTotal',
    value: String(dxbStation.resources.coolRoomSlotsTotal),
  },
  {
    key: 'resources.buildupBaysTotal',
    value: String(dxbStation.resources.buildupBaysTotal),
  },
  {
    key: 'resources.breakdownBaysTotal',
    value: String(dxbStation.resources.breakdownBaysTotal),
  },
  { key: 'policies.gpu', value: dxbStation.policies.gpu },
  {
    key: 'policies.shadingZones',
    value: dxbStation.policies.shadingZones.join(', '),
  },
  {
    key: 'policies.thermalBlanketStock',
    value: dxbStation.policies.thermalBlanketStock,
  },
  {
    key: 'policies.wetRagAuthorised',
    value: dxbStation.policies.wetRagAuthorised,
  },
  { key: 'operatingHours', value: dxbStation.operatingHours },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTemperatureValue(value: unknown): value is TemperatureValue {
  return (
    isRecord(value) &&
    typeof value.value === 'number' &&
    typeof value.unit === 'string'
  );
}

function isMaxWaitCurve(value: unknown): value is MaxWaitCurve {
  return (
    isRecord(value) &&
    typeof value.ambient25c === 'number' &&
    typeof value.ambient35c === 'number' &&
    typeof value.ambient40c === 'number' &&
    typeof value.ambient45c === 'number' &&
    (value.ambient30c === undefined || typeof value.ambient30c === 'number')
  );
}

function isShcEntry(value: unknown): value is ShcEntry {
  if (!isRecord(value) || !isRecord(value.temperatureInstructions)) {
    return false;
  }

  return (
    isTemperatureValue(value.temperatureInstructions.minTemperature) &&
    isTemperatureValue(value.temperatureInstructions.maxTemperature) &&
    isMaxWaitCurve(value.maxWaitMinutes) &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.description === undefined || typeof value.description === 'string')
  );
}

function isLoadedShcConfig(value: unknown): value is LoadedShcConfig {
  return (
    isRecord(value) &&
    isRecord(value.shc) &&
    Object.values(value.shc).every(isShcEntry) &&
    isRecord(value.default)
  );
}

function formatTemperature(value: TemperatureValue): string {
  return `${value.value}°${value.unit}`;
}

function formatReloadMessage(state: ReloadState, message: string): string {
  if (state === 'loading') {
    return 'Reloading SHC config from public/config/shc.json';
  }

  if (state === 'idle') {
    return 'Loaded from public/config/shc.json';
  }

  return message;
}

export default function AdminConfigPage() {
  const [forceMockWeather, setForceMockWeather] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [shcConfig, setShcConfig] = useState<LoadedShcConfig>(shcConfigData);
  const [reloadState, setReloadState] = useState<ReloadState>('idle');
  const [reloadMessage, setReloadMessage] = useState('Loaded from public/config/shc.json');

  useEffect(() => {
    setForceMockWeather(localPrefs.get('forceMockWeather', false));
    setPrefsHydrated(true);
  }, []);

  async function handleReloadShcConfig() {
    setReloadState('loading');

    try {
      const response = await fetch(`/config/shc.json?t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Reload failed with status ${response.status}.`);
      }

      const nextConfig: unknown = await response.json();

      if (!isLoadedShcConfig(nextConfig)) {
        throw new Error('Reloaded SHC config shape is invalid.');
      }

      setShcConfig(nextConfig);
      setReloadState('success');
      setReloadMessage(
        `Reloaded from public/config/shc.json at ${new Date().toLocaleTimeString()}`,
      );
    } catch (error) {
      console.error('Failed to reload SHC config.', error);
      setReloadState('error');
      setReloadMessage(
        error instanceof Error ? error.message : 'Failed to reload SHC config.',
      );
    }
  }

  const shcRows = Object.entries(shcConfig.shc).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </p>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-foreground">Config console</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Inspect the active SHC tolerance matrix, DXB station capabilities, and
              the weather-source override.
            </p>
          </div>
        </section>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl">Runtime flags</CardTitle>
            <CardDescription>
              Persist operator-side overrides through the local preferences helper.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">Force mock weather</p>
                <p className="text-sm text-muted-foreground">
                  Reads and writes the `forceMockWeather` flag via `localPrefs`.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-[0.18em]',
                    forceMockWeather ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {forceMockWeather ? 'mock enabled' : 'live weather'}
                </span>
                <Switch
                  checked={forceMockWeather}
                  disabled={!prefsHydrated}
                  onCheckedChange={(checked) => {
                    setForceMockWeather(checked);
                    localPrefs.set('forceMockWeather', checked);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-xl">SHC config</CardTitle>
              <CardDescription>
                Loaded tolerance ranges and airside wait curves for each configured SHC
                code.
              </CardDescription>
            </div>
            <Button
              className="sm:self-center"
              disabled={reloadState === 'loading'}
              onClick={() => {
                void handleReloadShcConfig();
              }}
              variant="outline"
            >
              Reload SHC config
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p
              className={cn(
                'text-sm',
                reloadState === 'error' && 'text-destructive',
                reloadState === 'success' && 'text-primary',
                reloadState === 'idle' && 'text-muted-foreground',
                reloadState === 'loading' && 'text-muted-foreground',
              )}
            >
              {formatReloadMessage(reloadState, reloadMessage)}
            </p>

            <Table>
              <TableCaption>Source: public/config/shc.json</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Min temp</TableHead>
                  <TableHead>Max temp</TableHead>
                  {ambientColumns.map((column) => (
                    <TableHead key={column.key}>{column.label} wait</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shcRows.map(([code, entry]) => (
                  <TableRow key={code}>
                    <TableCell className="font-semibold text-foreground">{code}</TableCell>
                    <TableCell className="font-mono text-xs sm:text-sm">
                      {formatTemperature(entry.temperatureInstructions.minTemperature)}
                    </TableCell>
                    <TableCell className="font-mono text-xs sm:text-sm">
                      {formatTemperature(entry.temperatureInstructions.maxTemperature)}
                    </TableCell>
                    {ambientColumns.map((column) => (
                      <TableCell
                        key={`${code}-${column.key}`}
                        className="font-mono text-xs sm:text-sm"
                      >
                        {entry.maxWaitMinutes[column.key]} min
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl">DXB station config</CardTitle>
            <CardDescription>
              Loaded station capabilities and local operating policies from
              `public/config/stations.json`.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {stationEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-lg border border-border/60 bg-background/50 p-4"
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {entry.key}
                  </dt>
                  <dd className="mt-2 break-words font-mono text-sm text-foreground">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
