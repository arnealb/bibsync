import type { SupabaseClient } from "@supabase/supabase-js";

import { getBibcoins } from "@/lib/bibcoins/queries";
import { MANAGEMENT_FEE_DAILY, holdingCap } from "@/lib/stock/config";
import { sellPrice, sharePrice, type StockState } from "@/lib/stock/engine";
import type { StockQuote, StockTick } from "@/lib/stock/types";
import { createClient } from "@/lib/supabase/server";

/** Casino house profit ("net") and total wagered, via the service-role RPC. */
export async function getCasinoStats(
  admin: SupabaseClient,
): Promise<{ net: number; wagered: number }> {
  const { data, error } = await admin.rpc("casino_stats");
  if (error) {
    console.error("[getCasinoStats]", error);
    return { net: 0, wagered: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { net: Number(row?.net ?? 0), wagered: Number(row?.wagered ?? 0) };
}

/** Current singleton fund state (plus its version for optimistic guarding). */
export async function getStockState(
  admin: SupabaseClient,
): Promise<StockState & { version: number }> {
  const { data } = await admin
    .from("casino_stock")
    .select("shares, treasury, baseline_net, version")
    .eq("id", true)
    .maybeSingle();
  return {
    shares: data?.shares ?? 0,
    treasury: Number(data?.treasury ?? 0),
    baselineNet: Number(data?.baseline_net ?? 0),
    version: data?.version ?? 0,
  };
}

/** Builds the full viewer-facing quote from the current fund + holdings. */
export async function buildQuote(
  admin: SupabaseClient,
  userId: string,
): Promise<StockQuote> {
  const [stats, state, holdingRes, balance] = await Promise.all([
    getCasinoStats(admin),
    getStockState(admin),
    admin
      .from("casino_holdings")
      .select("shares, cost_basis")
      .eq("user_id", userId)
      .maybeSingle(),
    getBibcoins(userId),
  ]);

  const myShares = holdingRes.data?.shares ?? 0;
  const myCostBasis = Number(holdingRes.data?.cost_basis ?? 0);
  const myValue = Math.floor(sellPrice(state, stats.net) * myShares);

  return {
    price: sharePrice(state, stats.net),
    sharesOutstanding: state.shares,
    myShares,
    myValue,
    myCostBasis,
    myPnl: myValue - myCostBasis,
    balance,
    houseProfit: stats.net,
    wagered: stats.wagered,
    holdingCap: holdingCap(state.shares),
    feeDaily: MANAGEMENT_FEE_DAILY,
  };
}

/** Recent price ticks (oldest → newest) for the chart. */
export async function getStockHistory(limit = 48): Promise<StockTick[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("casino_stock_history")
    .select("price, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getStockHistory]", error);
    return [];
  }
  return (data ?? [])
    .map((r) => ({ price: Number(r.price), recordedAt: r.recorded_at }))
    .reverse();
}
