"use client";

import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

import type { RoutePoint } from "@/lib/routes/types";

// Default view when no points yet: De Therminal (UGent, Hoveniersberg 24, Gent),
// the group's home base — so route planning starts right where they study.
const DEFAULT_CENTER: [number, number] = [51.0444, 3.7276];

function ClickCapture({ onAdd }: { onAdd: (p: RoutePoint) => void }) {
  useMapEvents({
    click(e) {
      onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function RouteMap({
  points,
  editable = false,
  onAdd,
  height = 280,
  circleRadiusM,
}: {
  points: RoutePoint[];
  editable?: boolean;
  onAdd?: (p: RoutePoint) => void;
  height?: number;
  /** Draws a radius circle around the first point (room geofence preview). */
  circleRadiusM?: number;
}) {
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);
  const center = positions[0] ?? DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {circleRadiusM != null && positions[0] && (
        <Circle
          center={positions[0]}
          radius={circleRadiusM}
          pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.12 }}
        />
      )}
      {positions.length > 1 && (
        <Polyline positions={positions} pathOptions={{ color: "#10b981", weight: 4 }} />
      )}
      {positions.map((pos, i) => (
        <CircleMarker
          key={`${pos[0]}-${pos[1]}-${i}`}
          center={pos}
          radius={6}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: i === 0 ? "#16a34a" : "#10b981",
            fillOpacity: 1,
          }}
        />
      ))}
      {editable && onAdd && <ClickCapture onAdd={onAdd} />}
    </MapContainer>
  );
}
