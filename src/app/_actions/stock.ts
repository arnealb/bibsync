"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext } from "@/lib/auth";
import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { holdingCap } from "@/lib/stock/config";
import { applyBuy, applySell, sharePrice, type StockState } from "@/lib/stock/engine";
import { buildQuote, getCasinoStats, getStockState } from "@/lib/stock/queries";
import type { StockQuote, StockTradeResult } from "@/lib/stock/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockTradeSchema, type StockTradeInput } from "@/lib/validation/stock";

/** Append a price tick (best-effort — never fails a trade). */
async function recordTick(
  admin: SupabaseClient,
  state: StockState,
  net: number,
): Promise<void> {
  const { error } = await admin.from("casino_stock_history").insert({
    price: sharePrice(state, net),
    shares: state.shares,
    net,
  });
  if (error) console.error("[recordTick]", error);
}

/** Full current quote for the signed-in viewer (used by the page + polling). */
export async function getStockQuote(): Promise<StockQuote | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  return buildQuote(admin, ctx.user.id);
}

/** Buy shares of the casino. Server-authoritative, version-guarded. */
export async function buyStock(
  input: StockTradeInput,
): Promise<StockTradeResult> {
  const parsed = stockTradeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { qty } = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.stock.unavailable };
  const userId = ctx.user.id;

  const { net } = await getCasinoStats(admin);
  const state = await getStockState(admin);

  // Anti-whale cap: a single holder can't corner the float.
  const { data: held } = await admin
    .from("casino_holdings")
    .select("shares")
    .eq("user_id", userId)
    .maybeSingle();
  const cap = holdingCap(state.shares);
  if ((held?.shares ?? 0) + qty > cap) {
    return { ok: false, error: copy.stock.capReached(cap) };
  }

  const { state: next, cost } = applyBuy(state, net, qty);

  const balance = await getBibcoins(userId);
  if (cost > balance) return { ok: false, error: copy.stock.cantAfford };

  const ref = `stock-buy:${userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(userId, cost, "stock_buy", ref);
  if (!paid) return { ok: false, error: copy.stock.cantAfford };

  const { data: updated } = await admin
    .from("casino_stock")
    .update({
      shares: next.shares,
      treasury: next.treasury,
      baseline_net: net,
      version: state.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("version", state.version)
    .select("version");

  if (!updated || updated.length === 0) {
    // Lost the race — give the coins back.
    await awardBibcoins(userId, cost, "stock_refund", ref);
    return { ok: false, error: copy.stock.busy };
  }

  const { data: h } = await admin
    .from("casino_holdings")
    .select("shares, cost_basis")
    .eq("user_id", userId)
    .maybeSingle();
  await admin.from("casino_holdings").upsert({
    user_id: userId,
    shares: (h?.shares ?? 0) + qty,
    cost_basis: Number(h?.cost_basis ?? 0) + cost,
    updated_at: new Date().toISOString(),
  });

  await recordTick(admin, next, net);
  return { ok: true, quote: await buildQuote(admin, userId) };
}

/** Sell shares back to the fund. Server-authoritative, version-guarded. */
export async function sellStock(
  input: StockTradeInput,
): Promise<StockTradeResult> {
  const parsed = stockTradeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { qty } = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.stock.unavailable };
  const userId = ctx.user.id;

  const { data: h } = await admin
    .from("casino_holdings")
    .select("shares, cost_basis")
    .eq("user_id", userId)
    .maybeSingle();
  const have = h?.shares ?? 0;
  if (have < qty) return { ok: false, error: copy.stock.notEnoughShares };

  const { net } = await getCasinoStats(admin);
  const state = await getStockState(admin);
  const { state: next, proceeds } = applySell(state, net, qty);

  // Authoritative fund update first; only pay out if it wins the race.
  const { data: updated } = await admin
    .from("casino_stock")
    .update({
      shares: next.shares,
      treasury: next.treasury,
      baseline_net: net,
      version: state.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("version", state.version)
    .select("version");

  if (!updated || updated.length === 0) {
    return { ok: false, error: copy.stock.busy };
  }

  if (proceeds > 0) {
    const ref = `stock-sell:${userId}:${crypto.randomUUID()}`;
    const awarded = await awardBibcoins(userId, proceeds, "stock_sell", ref);
    if (!awarded) console.error("[sellStock] payout failed", { userId, ref });
  }

  const oldBasis = Number(h?.cost_basis ?? 0);
  const newShares = have - qty;
  const newBasis =
    newShares <= 0 ? 0 : Math.max(0, oldBasis - Math.round((oldBasis * qty) / have));
  await admin.from("casino_holdings").upsert({
    user_id: userId,
    shares: newShares,
    cost_basis: newBasis,
    updated_at: new Date().toISOString(),
  });

  await recordTick(admin, next, net);
  return { ok: true, quote: await buildQuote(admin, userId) };
}
