"use client";

import "leaflet/dist/leaflet.css";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

type Props = {
  geojson: Record<string, unknown>;
  position: { latitude: number; longitude: number };
  label: string;
  inferred?: boolean;
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

const DXB_CENTER: LatLngExpression = [25.2532, 55.3657];
const DXB_ZOOM = 14;

type MapFeature = {
  properties?: {
    referenceAmbientDeltaC?: unknown;
  };
  geometry?: {
    type?: string;
  };
};

delete (
  L.Icon.Default.prototype as unknown as {
    _getIconUrl?: unknown;
  }
)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

function getZoneStyle(feature?: MapFeature) {
  const delta = feature?.properties?.referenceAmbientDeltaC;
  const isCoolingZone = typeof delta === "number" && delta < 0;

  return {
    color: isCoolingZone ? "var(--primary)" : "var(--border)",
    fillColor: isCoolingZone ? "var(--primary)" : "var(--muted)",
    weight: feature?.geometry?.type === "LineString" ? 3 : 1,
    opacity: 0.9,
    fillOpacity: feature?.geometry?.type === "LineString" ? 0 : 0.28,
  };
}

export function AirportMap({ geojson, position, label, inferred = false }: Props) {
  const { resolvedTheme } = useTheme();
  const tile = TILE_CONFIG[resolvedTheme === "dark" ? "dark" : "light"];

  return (
    <MapContainer
      center={DXB_CENTER}
      zoom={DXB_ZOOM}
      className="size-full rounded-xl"
      scrollWheelZoom={false}
    >
      <TileLayer attribution={tile.attribution} url={tile.url} />
      <GeoJSON data={geojson as never} style={getZoneStyle} />
      <Marker position={[position.latitude, position.longitude]}>
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{label}</span>
            <span>{inferred ? "Inferred position" : "Tracker position"}</span>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
