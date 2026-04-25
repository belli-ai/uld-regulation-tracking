"use client";

import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

type Props = {
  origin: { code: string; name: string; latitude: number; longitude: number };
  arrival: { code: string; name: string; latitude: number; longitude: number };
  flightProgress: number;
  label: string;
};

const TILE_CONFIG = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

delete (
  L.Icon.Default.prototype as unknown as {
    _getIconUrl?: unknown;
  }
)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url,
  ).toString(),
  iconUrl: new URL(
    "leaflet/dist/images/marker-icon.png",
    import.meta.url,
  ).toString(),
  shadowUrl: new URL(
    "leaflet/dist/images/marker-shadow.png",
    import.meta.url,
  ).toString(),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normaliseLongitude(value: number): number {
  if (value > 180) {
    return value - 360;
  }
  if (value < -180) {
    return value + 360;
  }
  return value;
}

function interpolateGreatCircle(
  from: Props["origin"],
  to: Props["arrival"],
  fraction: number,
) {
  const progress = clamp(fraction, 0, 1);
  const lat1 = toRadians(from.latitude);
  const lon1 = toRadians(from.longitude);
  const lat2 = toRadians(to.latitude);
  const lon2 = toRadians(to.longitude);

  const start = {
    x: Math.cos(lat1) * Math.cos(lon1),
    y: Math.cos(lat1) * Math.sin(lon1),
    z: Math.sin(lat1),
  };
  const end = {
    x: Math.cos(lat2) * Math.cos(lon2),
    y: Math.cos(lat2) * Math.sin(lon2),
    z: Math.sin(lat2),
  };

  const dot = clamp(start.x * end.x + start.y * end.y + start.z * end.z, -1, 1);
  const omega = Math.acos(dot);

  if (omega === 0) {
    return { latitude: from.latitude, longitude: from.longitude };
  }

  const sinOmega = Math.sin(omega);
  const startScale = Math.sin((1 - progress) * omega) / sinOmega;
  const endScale = Math.sin(progress * omega) / sinOmega;
  const point = {
    x: start.x * startScale + end.x * endScale,
    y: start.y * startScale + end.y * endScale,
    z: start.z * startScale + end.z * endScale,
  };

  return {
    latitude: toDegrees(
      Math.atan2(point.z, Math.sqrt(point.x ** 2 + point.y ** 2)),
    ),
    longitude: normaliseLongitude(toDegrees(Math.atan2(point.y, point.x))),
  };
}

function buildRoutePoints(
  origin: Props["origin"],
  arrival: Props["arrival"],
): LatLngExpression[] {
  return Array.from({ length: 20 }, (_, index) => {
    const point = interpolateGreatCircle(origin, arrival, index / 19);
    return [point.latitude, point.longitude] satisfies LatLngExpression;
  });
}

function FitRouteBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [bounds, map]);

  return null;
}

export function FlightOverviewMap({
  origin,
  arrival,
  flightProgress,
  label,
}: Props) {
  const { resolvedTheme } = useTheme();
  const tile = TILE_CONFIG[resolvedTheme === "dark" ? "dark" : "light"];
  const routePoints = buildRoutePoints(origin, arrival);
  const uldPoint = interpolateGreatCircle(origin, arrival, flightProgress);
  const bounds: LatLngBoundsExpression = [
    [origin.latitude, origin.longitude],
    [arrival.latitude, arrival.longitude],
  ];

  return (
    <MapContainer
      center={[origin.latitude, origin.longitude]}
      zoom={3}
      className="size-full"
      scrollWheelZoom={false}
    >
      <FitRouteBounds bounds={bounds} />
      <TileLayer attribution={tile.attribution} url={tile.url} />
      <Polyline
        positions={routePoints}
        pathOptions={{ color: "var(--primary)", weight: 3 }}
      />
      <Marker position={[origin.latitude, origin.longitude]}>
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{origin.code}</span>
            <span>{origin.name}</span>
          </div>
        </Popup>
      </Marker>
      <Marker position={[arrival.latitude, arrival.longitude]}>
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{arrival.code}</span>
            <span>{arrival.name}</span>
          </div>
        </Popup>
      </Marker>
      <Marker position={[uldPoint.latitude, uldPoint.longitude]}>
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{label}</span>
            <span>
              Flight progress {Math.round(clamp(flightProgress, 0, 1) * 100)}%
            </span>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
