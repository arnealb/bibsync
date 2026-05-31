import type { RoutePoint } from "@/lib/routes/types";

/**
 * Fixed quick-pick destinations, always shown as clickable chips next to the
 * room's previously-used places. Clicking one fills the destination field just
 * like a saved place would.
 */
export type DestinationPreset = {
  /** Stable key for the React list. */
  key: string;
  /** Chip label (emoji + text). */
  label: string;
  /** Value written into the destination field. */
  name: string;
  isWalk: boolean;
  points: RoutePoint[];
};

export const DESTINATION_PRESETS: readonly DestinationPreset[] = [
  {
    key: "smoke",
    label: "🚬 Sigaretje",
    name: "🚬 Sigaretje",
    isWalk: false,
    points: [],
  },
];
