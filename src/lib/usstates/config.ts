import { US_STATES } from "@/lib/usstates/states";

/** Round length in seconds (5:00 countdown). */
export const USSTATES_DURATION_SECONDS = 300;

/** Bibcoins paid per freshly-named state (capped to once per state per day). */
export const USSTATES_COINS_PER_STATE = 10;

/** Total states to name. */
export const USSTATES_TOTAL = US_STATES.length;
