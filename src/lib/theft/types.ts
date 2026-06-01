/** Result of a steal attempt. */
export type StealResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/** Result of an "ik ben bestolen" claim. */
export type ClaimResult =
  /** Caught the thief — paid back (2× the stolen amount, fund-permitting). */
  | { ok: true; kind: "reward"; amount: number; balance: number }
  /** You were robbed but claimed too late (already spent since). */
  | { ok: true; kind: "late" }
  /** False claim — you weren't robbed, so you paid the penalty to the casino. */
  | { ok: true; kind: "penalty"; amount: number; balance: number }
  | { ok: false; error: string };
