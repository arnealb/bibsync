import { US_STATES } from "@/lib/usstates/states";

/** Strip case and normalise whitespace; nothing else (matching stays strict). */
export function normalizeGuess(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const BY_NORMALIZED_NAME = new Map(
  US_STATES.map((s) => [normalizeGuess(s.name), s.code]),
);

/**
 * Strict English match. Returns the postal code of the state the guess names,
 * or null when it matches nothing or matches an already-found state. No
 * abbreviations, no fuzzy/typo tolerance.
 */
export function matchState(
  guess: string,
  found: ReadonlySet<string>,
): string | null {
  const code = BY_NORMALIZED_NAME.get(normalizeGuess(guess));
  if (!code || found.has(code)) return null;
  return code;
}
