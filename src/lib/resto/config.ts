/**
 * UGent resto (Hydra) menu config.
 *
 * The official UGent student app "Hydra" exposes a public, server-rendered
 * JSON feed of the resto menus — far more robust than scraping the weekmenu
 * HTML page. `overview.json` returns the upcoming ~2 weeks of days.
 *
 * The room dashboard shows the menu for **Resto Sterre / De Brug** (they share
 * one menu), matching the weekmenu link the students use.
 */
export const RESTO_API_BASE = "https://hydra.ugent.be/api/2.0/resto/menu";

/** Hydra endpoint key for the Sterre / De Brug menu. */
export const RESTO_ENDPOINT = "nl-sterre";

/** Cache the feed for an hour — the menu never changes within a day. */
export const RESTO_REVALIDATE_SECONDS = 3600;

/** Order the main dishes are listed in, by `kind`. */
export const MAIN_KIND_ORDER = [
  "meat",
  "fish",
  "vegetarian",
  "vegan",
] as const;
