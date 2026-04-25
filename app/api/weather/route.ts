import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import {
  adaptMockWeather,
  adaptOpenMeteo,
  type CanonicalWeather,
} from "@/lib/adapters/weather";

export const dynamic = "force-dynamic";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  DXB: { lat: 25.2532, lon: 55.3657 },
  FRA: { lat: 50.0379, lon: 8.5622 },
  LHR: { lat: 51.47, lon: -0.4543 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  SIN: { lat: 1.3644, lon: 103.9915 },
};

const LIVE_TIMEOUT_MS = 3000;

async function readMockWeather(airport: string): Promise<CanonicalWeather> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "weather",
    `${airport}.json`,
  );
  const raw = await fs.readFile(filePath, "utf-8");
  return adaptMockWeather(JSON.parse(raw), airport);
}

export async function GET(req: NextRequest) {
  const airport = (
    req.nextUrl.searchParams.get("airport") ?? "DXB"
  ).toUpperCase();
  const coords = AIRPORT_COORDS[airport];

  if (coords) {
    try {
      const url =
        `${OPEN_METEO_BASE}?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&hourly=temperature_2m,relative_humidity_2m,cloud_cover` +
        `&forecast_days=2&timezone=auto`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const live = adaptOpenMeteo(await res.json(), airport);
      return Response.json(live);
    } catch (err) {
      console.warn(
        `weather: live fetch failed for ${airport}, using mock`,
        err,
      );
    }
  }

  try {
    const mock = await readMockWeather(airport);
    return Response.json(mock);
  } catch (err) {
    console.error("weather: mock fallback unavailable", err);
    return Response.json({ error: "weather unavailable" }, { status: 503 });
  }
}
