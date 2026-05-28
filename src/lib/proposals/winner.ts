/**
 * Picks the winning option among a set of proposals: the one with the highest
 * "yes" weight. Returns null when nobody voted yes. Ties keep the first id.
 *
 * The caller supplies `yesWeight` (sum of vote weights of the "yes" voters) so
 * this stays generic over the different proposal kinds.
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

/**
 * The break time the most people back for a fixed slot. A person backs a time
 * by preferring it (their own suggestion) or voting "yes" on a suggestion at
 * that time; backers are de-duplicated and weighted by `weightOf`. Ties resolve
 * to the earliest time. Returns null when there are no suggestions yet.
 */
export function decideSlotTime(
  suggestions: { id: string; start_time: string; created_by: string }[],
  votes: { proposal_id: string; user_id: string; vote: string }[],
  weightOf: (userId: string) => number,
): string | null {
  if (suggestions.length === 0) return null;

  const timeOf = new Map(
    suggestions.map((s) => [s.id, s.start_time.slice(0, 5)]),
  );
  const backers = new Map<string, Set<string>>();
  const back = (time: string, userId: string) => {
    const set = backers.get(time);
    if (set) set.add(userId);
    else backers.set(time, new Set([userId]));
  };

  for (const s of suggestions) back(s.start_time.slice(0, 5), s.created_by);
  for (const v of votes) {
    if (v.vote !== "yes") continue;
    const time = timeOf.get(v.proposal_id);
    if (time) back(time, v.user_id);
  }

  let bestTime: string | null = null;
  let bestScore = -1;
  // Ascending time order so the earliest time wins any tie.
  for (const time of [...backers.keys()].sort()) {
    let score = 0;
    for (const userId of backers.get(time)!) score += weightOf(userId);
    if (score > bestScore) {
      bestScore = score;
      bestTime = time;
    }
  }
  return bestTime;
}
