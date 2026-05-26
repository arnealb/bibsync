/**
 * Step aggregation. The two sources have different semantics:
 *   - 'health'  rows carry the *running daily total* from Apple Health, so a
 *     day's value is the HIGHEST one seen (later runs report more steps).
 *   - 'browser' rows are pedometer *increments*, so they SUM.
 * A day's total combines both (most people use one method; mixing just adds
 * them). Pure and deterministic so it can back both queries and rewards.
 */

export interface DailyStepRow {
  user_id: string;
  steps: number;
  recorded_for: string;
  source: string;
}

/** A single user's step total for one day. */
export function dayTotal(rows: { steps: number; source: string }[]): number {
  let healthMax = 0;
  let browserSum = 0;
  for (const row of rows) {
    if (row.source === "health") {
      healthMax = Math.max(healthMax, row.steps);
    } else {
      browserSum += row.steps;
    }
  }
  return healthMax + browserSum;
}

export interface UserTotals {
  /** Per-user step total for `today`. */
  today: Map<string, number>;
  /** Per-user step total across all days. */
  allTime: Map<string, number>;
}

/** Folds raw step rows into per-user today/all-time totals. */
export function aggregateByUser(
  rows: DailyStepRow[],
  today: string,
): UserTotals {
  const byUserDay = new Map<
    string,
    Map<string, { steps: number; source: string }[]>
  >();
  for (const row of rows) {
    let days = byUserDay.get(row.user_id);
    if (!days) {
      days = new Map();
      byUserDay.set(row.user_id, days);
    }
    const list = days.get(row.recorded_for);
    if (list) {
      list.push({ steps: row.steps, source: row.source });
    } else {
      days.set(row.recorded_for, [{ steps: row.steps, source: row.source }]);
    }
  }

  const todayTotals = new Map<string, number>();
  const allTotals = new Map<string, number>();
  for (const [userId, days] of byUserDay) {
    let allSum = 0;
    for (const [day, list] of days) {
      const total = dayTotal(list);
      allSum += total;
      if (day === today) todayTotals.set(userId, total);
    }
    allTotals.set(userId, allSum);
  }
  return { today: todayTotals, allTime: allTotals };
}
