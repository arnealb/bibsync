/**
 * Inside joke: a certain group member is always "alan". Anyone whose display
 * name contains "alan" or "chakalaka" shows up as "alan" in the vote list.
 */
const JOKE_PATTERN = /alan|chakalaka/i;

export function isJokeUser(name: string): boolean {
  return JOKE_PATTERN.test(name);
}

/** Name to render in the voters list (swaps joke users to "alan"). */
export function voterDisplayName(name: string): string {
  return isJokeUser(name) ? "alan" : name;
}
