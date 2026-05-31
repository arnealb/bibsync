"use server";

import {
  claimDailyBibcoins,
  claimHourlyBibcoins,
  transferBibcoins,
} from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import { transferBibcoinsSchema } from "@/lib/validation/bibcoins";

type ClaimResult = { ok: true; granted: number } | { ok: false };

export type TransferResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/** Send bibcoins from the current user to another user. */
export async function sendBibcoins(input: {
  recipientId: string;
  amount: number;
}): Promise<TransferResult> {
  const parsed = transferBibcoinsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { recipientId, amount } = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  if (recipientId === ctx.user.id) {
    return { ok: false, error: copy.bibcoins.transfer.self };
  }

  // The recipient must be a real profile.
  const supabase = await createClient();
  const { data: recipient } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .maybeSingle();
  if (!recipient) return { ok: false, error: copy.bibcoins.transfer.noUser };

  const ref = `transfer:${ctx.user.id}:${crypto.randomUUID()}`;
  const ok = await transferBibcoins(ctx.user.id, recipientId, amount, ref);
  if (!ok) return { ok: false, error: copy.bibcoins.transfer.failed };

  return { ok: true, balance: await getBibcoins(ctx.user.id) };
}

/** Credits the hourly passive trickle for the current user. */
export async function claimHourly(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const granted = await claimHourlyBibcoins(ctx.user.id);
  return { ok: true, granted };
}

/** Credits the once-a-day login bonus for the current user. */
export async function claimDaily(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const granted = await claimDailyBibcoins(ctx.user.id);
  return { ok: true, granted };
}
