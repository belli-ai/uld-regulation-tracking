'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlightCard } from '@/components/flight-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useFlightsStore } from '@/lib/stores/flights-store';
import { cn } from '@/lib/utils';

function LoadingSkeleton() {
  return (
    <Card className="bg-card text-card-foreground rounded-xl border py-6 shadow-sm">
      <div className="flex flex-col gap-4 px-6">
        <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-14 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-10 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-12 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function getWeatherBadgeClass(weatherSource: 'live' | 'mock' | null): string {
  if (weatherSource === 'live') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }

  if (weatherSource === 'mock') {
    return 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400';
  }

  return 'border-border bg-muted text-muted-foreground';
}

function getWeatherBadgeLabel(weatherSource: 'live' | 'mock' | null): string {
  if (weatherSource === 'live') {
    return 'LIVE';
  }

  if (weatherSource === 'mock') {
    return 'MOCK';
  }

  return 'WEATHER';
}

export default function HomePage() {
  const router = useRouter();
  const { flights, weatherSource, loading, error, loadFlights } = useFlightsStore(
    (state) => ({
      flights: state.flights,
      weatherSource: state.weatherSource,
      loading: state.loading,
      error: state.error,
      loadFlights: state.loadFlights,
    }),
  );

  useEffect(() => {
    void loadFlights();
  }, [loadFlights]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-base font-semibold text-foreground">
              Cool-Chain Copilot
            </h1>
          </div>
          <Badge
            variant="outline"
            className={cn('font-mono text-xs font-semibold', getWeatherBadgeClass(weatherSource))}
          >
            {getWeatherBadgeLabel(weatherSource)}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="flex flex-col gap-2 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            DXB outbound
          </p>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-foreground">Today&apos;s flights</h2>
            <p className="text-base text-muted-foreground">
              Track outbound departures, weather source, and build readiness.
            </p>
          </div>
        </section>

        {error ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-card px-6 text-center">
            <p className="text-base text-destructive">{error}</p>
          </div>
        ) : null}

        {!error && loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <LoadingSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {!error && !loading && flights.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
            <p className="text-base text-muted-foreground">No outbound flights today</p>
          </div>
        ) : null}

        {!error && !loading && flights.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flights.map((flight) => (
              <FlightCard
                key={flight['@id']}
                flight={flight}
                onClick={() => router.push('/flight/' + flight.flightNumber)}
              />
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
