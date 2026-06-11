import type { HorseColor } from "@/lib/horses/config";

/** Static Tailwind classes per horse colour (no dynamic class names). */
export const HORSE_COLOR_UI: Record<
  HorseColor,
  { dot: string; text: string; ring: string; bar: string }
> = {
  red: {
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500",
    bar: "bg-red-500",
  },
  blue: {
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500",
    bar: "bg-blue-500",
  },
  green: {
    dot: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    ring: "ring-green-500",
    bar: "bg-green-500",
  },
  yellow: {
    dot: "bg-yellow-400",
    text: "text-yellow-600 dark:text-yellow-400",
    ring: "ring-yellow-400",
    bar: "bg-yellow-400",
  },
  purple: {
    dot: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500",
    bar: "bg-purple-500",
  },
  orange: {
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500",
    bar: "bg-orange-500",
  },
};
