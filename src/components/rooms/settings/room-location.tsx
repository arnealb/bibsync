"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearRoomLocation, setRoomLocation } from "@/app/_actions/rooms";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/lib/copy";
import type { RoutePoint } from "@/lib/routes/types";

// De Therminal (UGent, Hoveniersberg 24, Gent) — the group's home base.
const THERMINAL: RoutePoint = { lat: 51.0444, lng: 3.7276 };
const RADII = [50, 100, 150, 250, 500, 1000] as const;

const RouteMap = dynamic(
  () => import("@/components/routes/route-map").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
        {copy.common.loading}
      </div>
    ),
  },
);

export function RoomLocationSettings({
  roomId,
  initialLat,
  initialLng,
  initialRadiusM,
}: {
  roomId: string;
  initialLat: number | null;
  initialLng: number | null;
  initialRadiusM: number;
}) {
  const [point, setPoint] = useState<RoutePoint | null>(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [radiusM, setRadiusM] = useState(initialRadiusM);
  const [pending, start] = useTransition();

  function save() {
    if (!point) return;
    start(async () => {
      const result = await setRoomLocation({
        roomId,
        lat: point.lat,
        lng: point.lng,
        radiusM,
      });
      if (result.ok) toast.success(copy.rooms.settings.locationSaved);
      else toast.error(result.error);
    });
  }

  function clear() {
    start(async () => {
      const result = await clearRoomLocation(roomId);
      if (result.ok) {
        setPoint(null);
        toast.success(copy.rooms.settings.locationCleared);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {copy.rooms.settings.locationHint}
      </p>

      <RouteMap
        points={point ? [point] : []}
        editable
        onAdd={(p) => setPoint(p)}
        circleRadiusM={point ? radiusM : undefined}
      />

      <p className="text-xs text-muted-foreground">
        {point
          ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : copy.rooms.settings.locationPick}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPoint(THERMINAL)}
        >
          {copy.rooms.settings.locationUseTherminal}
        </Button>

        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">
            {copy.rooms.settings.locationRadius}
          </span>
          <Select
            value={String(radiusM)}
            onValueChange={(v) => setRadiusM(Number(v ?? radiusM))}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADII.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r} m
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!point || pending} onClick={save}>
          {copy.rooms.settings.locationSave}
        </Button>
        {(initialLat != null || point) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={clear}
          >
            {copy.rooms.settings.locationClear}
          </Button>
        )}
      </div>
    </div>
  );
}
