/** Tuning for the "Pauze nu" instant-break coordination feature. */

/** Rolling window in which presses must land to count together. */
export const INSTANT_BREAK_WINDOW_SECONDS = 90;

/** Number of distinct members whose presses, within the window, declare a break. */
export const INSTANT_BREAK_THRESHOLD = 2;

/** Selectable break lengths (minutes) offered next to the button. */
export const INSTANT_BREAK_DURATIONS = [10, 15, 30, 45, 60] as const;

/** Pre-selected duration. */
export const DEFAULT_INSTANT_BREAK_DURATION = 15;

/** Accepted range for a server-validated duration. */
export const MIN_INSTANT_BREAK_DURATION = 5;
export const MAX_INSTANT_BREAK_DURATION = 180;
