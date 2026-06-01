import { z } from "zod";

import { MAX_TRADE_QTY } from "@/lib/stock/config";

/** A buy/sell order: a whole number of shares within sane bounds. */
export const stockTradeSchema = z.object({
  qty: z.number().int().min(1).max(MAX_TRADE_QTY),
});

export type StockTradeInput = z.infer<typeof stockTradeSchema>;
