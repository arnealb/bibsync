/**
 * Theft-debt helpers. These MIRROR the SQL in
 * supabase/migrations/0061_theft_debt.sql — the SQL is authoritative; keep
 * both in sync when tuning.
 */

/**
 * Split a wallet credit between the user and their outstanding debt: half of
 * every credit (rounded down, capped at the remaining debt) is garnished —
 * burned — until the debt is gone. Mirror of garnish_wallet_credit(): a
 * non-positive amount passes through untouched, exactly like the trigger's
 * `_gain <= 0` early return.
 */
export function garnishSplit(
  amount: number,
  debt: number,
): { kept: number; garnished: number } {
  if (amount <= 0 || debt <= 0) return { kept: amount, garnished: 0 };
  const garnished = Math.min(debt, Math.floor(amount / 2));
  return { kept: amount - garnished, garnished };
}

/**
 * Award reasons the garnish trigger skips: refunds give back coins the user
 * already had, they are not income. Mirror of the predicate in
 * award_bibcoins() (migration 0061).
 */
export function isGarnishExempt(reason: string): boolean {
  return (
    reason.includes("refund") ||
    reason === "crate_dup" ||
    reason === "theft_seizure"
  );
}
