"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Map as MapIcon, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { RoutePoint } from "@/lib/routes/types";

// Leaflet touches `window`, so load the map only on the client.
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

interface RouteFieldProps {
  points: RoutePoint[];
  editable?: boolean;
  onChange?: (points: RoutePoint[]) => void;
}

export function RouteField({ points, editable = false, onChange }: RouteFieldProps) {
  const [open, setOpen] = useState(false);

  const label =
    points.length > 0
      ? editable
        ? copy.proposals.route.points(points.length)
        : copy.proposals.route.view(points.length)
      : copy.proposals.route.plot;

  // Read-only with no route to show: nothing to render.
  if (!editable && points.length === 0) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        <MapIcon className="size-4" />
        {label}
      </Button>

      {open && (
        <div className="space-y-2">
          {editable && (
            <p className="text-xs text-muted-foreground">
              {copy.proposals.route.hint}
            </p>
          )}
          <RouteMap
            points={points}
            editable={editable}
            onAdd={
              editable && onChange
                ? (p) => onChange([...points, p])
                : undefined
            }
          />
          {editable && onChange && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={points.length === 0}
                onClick={() => onChange(points.slice(0, -1))}
              >
                <Undo2 className="size-4" />
                {copy.proposals.route.undo}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={points.length === 0}
                onClick={() => onChange([])}
              >
                <Trash2 className="size-4" />
                {copy.proposals.route.clear}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
