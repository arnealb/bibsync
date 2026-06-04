/**
 * How many shares to force-sell to recover `shortfall` bibcoins at the current
 * NAV sell price. Rounds up (one share too many beats one too few — the excess
 * change stays in the thief's wallet) and is capped at what they actually
 * hold. A price of 0 (fund underwater / no shares) can recover nothing.
 */
export function sharesToCover(
  shortfall: number,
  price: number,
  heldShares: number,
): number {
  if (shortfall <= 0 || price <= 0 || heldShares <= 0) return 0;
  return Math.min(heldShares, Math.ceil(shortfall / price));
}
