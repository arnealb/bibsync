import { MAIN_KIND_ORDER } from "./config";
import type { RestoDay, RestoMeal } from "./types";

export interface MenuSection {
  kind: string;
  meals: RestoMeal[];
}

/** Main dishes grouped by `kind`, in a stable display order; empty groups dropped. */
export function mainsByKind(day: RestoDay): MenuSection[] {
  const mains = day.meals.filter((meal) => meal.type === "main");
  return MAIN_KIND_ORDER.map((kind) => ({
    kind,
    meals: mains.filter((meal) => meal.kind === kind),
  })).filter((section) => section.meals.length > 0);
}

/**
 * Distinct soup names. The feed lists each soup twice (klein/groot) and may
 * append a "/ € x,xx" fragment — strip both so we show one clean name per soup.
 */
export function soupNames(day: RestoDay): string[] {
  const names = day.meals
    .filter((meal) => meal.kind === "soup")
    .map((meal) =>
      meal.name
        .replace(/\s*\/\s*€.*/i, "")
        .replace(/\s*(klein|groot)\s*$/i, "")
        .trim(),
    )
    .filter(Boolean);
  return [...new Set(names)];
}

/** Only show a price when it actually looks like one — the feed sometimes garbles it. */
export function cleanPrice(price?: string | null): string | null {
  if (!price) return null;
  const trimmed = price.trim();
  return /€\s*\d/.test(trimmed) ? trimmed : null;
}
