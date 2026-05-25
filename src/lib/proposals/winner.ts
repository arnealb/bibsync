/**
 * Picks the winning option among a set of proposals: the one with the highest
 * "yes" weight. Returns null when nobody voted yes. Ties keep the first id.
 *
 * The caller supplies `yesWeight` (sum of vote weights of the "yes" voters) so
 * this stays generic over break proposals and food proposals.
 */
export function pickWinnerId(
  ids: string[],
  yesWeight: (id: string) => number,
): string | null {
  let bestId: string | null = null;
  let best = 0;
  for (const id of ids) {
    const weight = yesWeight(id);
    if (weight > best) {
      best = weight;
      bestId = id;
    }
  }
  return bestId;
}
