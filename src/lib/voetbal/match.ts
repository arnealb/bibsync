/** Pure player-name matching helpers — safe in client components. */

/**
 * Normalise a name for comparison: strip diacritics, lowercase, drop anything
 * that isn't a letter or digit (so "De Bruyne", "de-bruyne" and "debruyne" all
 * collapse to the same key, and accents like "Mbappé" don't matter).
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Initials of a display name, e.g. "Kevin De Bruyne" → "K.D.B.". */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((w) => w[0]!.toUpperCase()).join(".") + ".";
}

interface Acceptable {
  accept: string[];
}

/**
 * Index of the first player whose accepted answers contain the guess (after
 * normalisation), or -1 when nothing matches. Accept lists should be unique
 * within a category so a guess can't resolve to the wrong card.
 */
export function matchGuess(players: Acceptable[], guess: string): number {
  const g = normalizeName(guess);
  if (!g) return -1;
  return players.findIndex((p) =>
    p.accept.some((a) => normalizeName(a) === g),
  );
}
