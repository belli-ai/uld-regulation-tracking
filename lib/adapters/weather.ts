export type WeatherSource = "live" | "mock";

export type AmbientReading = {
  timestamp: string;
  ambientC: number;
  humidityPct?: number;
  cloudCoverPct?: number;
};

export type CanonicalWeather = {
  airport: string;
  source: WeatherSource;
  generatedAt: string;
  hourly: AmbientReading[];
};

type RawOpenMeteoHourly = {
  time?: unknown;
  temperature_2m?: unknown;
  relative_humidity_2m?: unknown;
  cloud_cover?: unknown;
};

type RawOpenMeteoResponse = {
  hourly?: RawOpenMeteoHourly;
  current?: { time?: unknown };
};

type RawMockHourly = {
  timestamp?: unknown;
  ambientC?: unknown;
  humidityPct?: unknown;
  cloudCoverPct?: unknown;
};

type RawMockWeather = {
  airport?: unknown;
  generatedAt?: unknown;
  hourly?: unknown;
};

function pickNumber(values: unknown, index: number): number | undefined {
  if (!Array.isArray(values)) return undefined;
  const candidate = values[index];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function pickString(values: unknown, index: number): string | undefined {
  if (!Array.isArray(values)) return undefined;
  const candidate = values[index];
  return typeof candidate === "string" ? candidate : undefined;
}

export function adaptOpenMeteo(
  raw: unknown,
  airport: string,
): CanonicalWeather {
  const root = (raw ?? {}) as RawOpenMeteoResponse;
  const hourlyBlock = root.hourly ?? {};
  const times = Array.isArray(hourlyBlock.time) ? hourlyBlock.time : [];
  const temps = hourlyBlock.temperature_2m;
  const humid = hourlyBlock.relative_humidity_2m;
  const clouds = hourlyBlock.cloud_cover;
  const hourly: AmbientReading[] = [];
  for (let i = 0; i < times.length; i++) {
    const timestamp = pickString(times, i);
    const ambientC = pickNumber(temps, i);
    if (!timestamp || ambientC === undefined) continue;
    const reading: AmbientReading = { timestamp, ambientC };
    const humidityPct = pickNumber(humid, i);
    if (humidityPct !== undefined) reading.humidityPct = humidityPct;
    const cloudCoverPct = pickNumber(clouds, i);
    if (cloudCoverPct !== undefined) reading.cloudCoverPct = cloudCoverPct;
    hourly.push(reading);
  }
  return {
    airport,
    source: "live",
    generatedAt:
      (typeof root.current?.time === "string" ? root.current.time : "") ||
      (hourly[0]?.timestamp ?? new Date().toISOString()),
    hourly,
  };
}

export function adaptMockWeather(
  raw: unknown,
  airportFallback: string,
): CanonicalWeather {
  const root = (raw ?? {}) as RawMockWeather;
  const hourlyArr = Array.isArray(root.hourly) ? root.hourly : [];
  const hourly: AmbientReading[] = [];
  for (const entry of hourlyArr as RawMockHourly[]) {
    const timestamp =
      typeof entry?.timestamp === "string" ? entry.timestamp : undefined;
    const ambientC =
      typeof entry?.ambientC === "number" && Number.isFinite(entry.ambientC)
        ? entry.ambientC
        : undefined;
    if (!timestamp || ambientC === undefined) continue;
    const reading: AmbientReading = { timestamp, ambientC };
    if (
      typeof entry.humidityPct === "number" &&
      Number.isFinite(entry.humidityPct)
    ) {
      reading.humidityPct = entry.humidityPct;
    }
    if (
      typeof entry.cloudCoverPct === "number" &&
      Number.isFinite(entry.cloudCoverPct)
    ) {
      reading.cloudCoverPct = entry.cloudCoverPct;
    }
    hourly.push(reading);
  }
  return {
    airport: typeof root.airport === "string" ? root.airport : airportFallback,
    source: "mock",
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : (hourly[0]?.timestamp ?? new Date().toISOString()),
    hourly,
  };
}
