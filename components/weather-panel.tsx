"use client";

import { Clock, CloudSun } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WeatherSourceBadge } from "@/components/weather-source-badge";
import type { AmbientReading, CanonicalWeather } from "@/lib/adapters/weather";

const DUBAI_TIME_ZONE = "Asia/Dubai";

function readWeatherTimeMs(reading: AmbientReading): number | null {
  const parsed = Date.parse(reading.timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentReading(
  weather: CanonicalWeather,
  nowMs: number,
): AmbientReading | null {
  const sorted = weather.hourly
    .map((reading) => ({ reading, timeMs: readWeatherTimeMs(reading) }))
    .filter(
      (entry): entry is { reading: AmbientReading; timeMs: number } =>
        entry.timeMs !== null,
    )
    .sort((left, right) => left.timeMs - right.timeMs);

  if (sorted.length === 0) {
    return null;
  }

  const latestPast = [...sorted]
    .reverse()
    .find((entry) => entry.timeMs <= nowMs);

  return (latestPast ?? sorted[0]).reading;
}

function getPrediction(
  weather: CanonicalWeather,
  nowMs: number,
  count = 5,
): AmbientReading[] {
  const future = weather.hourly
    .filter((reading) => {
      const ms = readWeatherTimeMs(reading);
      return ms !== null && ms >= nowMs;
    })
    .slice(0, count);

  return future.length > 0 ? future : weather.hourly.slice(0, count);
}

function formatPredictionTime(reading: AmbientReading): string {
  const ms = readWeatherTimeMs(reading);
  if (ms === null) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: DUBAI_TIME_ZONE,
  }).format(new Date(ms));
}

type Props = {
  weather: CanonicalWeather;
  nowMs: number;
  isRefreshing?: boolean;
  description?: string;
};

export function WeatherPanel({
  weather,
  nowMs,
  isRefreshing = false,
  description = "DXB ramp now and forecast.",
}: Props) {
  const current = getCurrentReading(weather, nowMs);
  const prediction = getPrediction(weather, nowMs);

  return (
    <Card className="mission-panel border-border/80">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Weather</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <WeatherSourceBadge source={weather.source} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="border border-border/70 bg-background/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <CloudSun data-icon="inline-start" />
              Current
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-foreground">
              {current ? `${current.ambientC.toFixed(1)}C` : "--.-C"}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {typeof current?.humidityPct === "number"
                ? `${current.humidityPct.toFixed(0)}% humidity`
                : "Humidity unavailable"}
            </p>
          </div>
          <div className="border border-border/70 bg-background/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Clock data-icon="inline-start" />
              Feed
            </div>
            <div className="mt-2 font-mono text-base font-semibold text-foreground">
              {isRefreshing ? "Refreshing" : "Ready"}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated{" "}
              {formatPredictionTime({
                ambientC: 0,
                timestamp: weather.generatedAt,
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Prediction
          </div>
          {prediction.map((reading) => (
            <div
              key={`${reading.timestamp}-${reading.ambientC}`}
              className="flex items-center justify-between gap-3 border border-border/60 bg-background/30 px-3 py-2 text-sm"
            >
              <span className="font-mono text-muted-foreground">
                {formatPredictionTime(reading)}
              </span>
              <span className="font-mono font-semibold text-foreground">
                {reading.ambientC.toFixed(1)}C
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
