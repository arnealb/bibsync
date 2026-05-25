/**
 * Inside joke: a certain group member has reduced voting power. Anyone whose
 * display name contains "alan" or "chakalaka" only counts for half a vote.
 */
const JOKE_PATTERN = /alan|chakalaka/i;
const REDUCED_WEIGHT = 0.5;

export function isJokeUser(name: string): boolean {
  return JOKE_PATTERN.test(name);
}

/** Voting weight for a user: 0.5 for joke users, 1 otherwise. */
export function voteWeight(name: string): number {
  return isJokeUser(name) ? REDUCED_WEIGHT : 1;
}

/** Formats a (possibly fractional) vote tally, e.g. 3 or "2.5". */
export function formatTally(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}
