import "server-only";

import {
  RESTO_API_BASE,
  RESTO_ENDPOINT,
  RESTO_REVALIDATE_SECONDS,
} from "./config";
import { restoOverviewSchema, type RestoDay } from "./types";

/**
 * Fetch the resto menu for a single Brussels date (`YYYY-MM-DD`).
 *
 * Returns `null` on any failure (network, bad payload, or simply no menu for
 * that day — e.g. weekends/holidays) so callers can quietly skip rendering.
 * The feed is cached for an hour via Next's fetch revalidation.
 */
export async function getRestoMenu(date: string): Promise<RestoDay | null> {
  try {
    const res = await fetch(
      `${RESTO_API_BASE}/${RESTO_ENDPOINT}/overview.json`,
      { next: { revalidate: RESTO_REVALIDATE_SECONDS } },
    );
    if (!res.ok) {
      console.error(`Resto menu fetch failed: HTTP ${res.status}`);
      return null;
    }

    const parsed = restoOverviewSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.error("Resto menu payload invalid", parsed.error.flatten());
      return null;
    }

    return parsed.data.find((day) => day.date === date) ?? null;
  } catch (error) {
    console.error("Resto menu fetch error", error);
    return null;
  }
}
