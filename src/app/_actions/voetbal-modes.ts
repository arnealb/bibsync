"use server";

import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VOETBAL_HL_COINS,
  VOETBAL_MYSTERY_COINS,
  VOETBAL_QUIZ_COINS,
} from "@/lib/voetbal/config";
import { awardVoetbalCapped } from "@/lib/voetbal/earn";
import { initials, matchGuess } from "@/lib/voetbal/match";
import { STAT_PLAYERS, statPlayer } from "@/lib/voetbal/players";
import { QUIZ_QUESTIONS, quizQuestion } from "@/lib/voetbal/quiz";
import {
  hogerLagerGuessSchema,
  mysteryGuessSchema,
  quizAnswerSchema,
  type HogerLagerGuessInput,
  type MysteryGuessInput,
  type QuizAnswerInput,
} from "@/lib/validation/voetbal";

/** Crypto-strong random integer in [0, n). */
function randInt(n: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % n;
}

// ── Hoger / Lager ───────────────────────────────────────────────────────────

export interface HLPlayerPublic {
  name: string;
  flag: string;
  country: string;
  position: string;
}

export type HogerLagerRound =
  | {
      ok: true;
      roundId: string;
      left: HLPlayerPublic & { value: number };
      right: HLPlayerPublic;
    }
  | { ok: false; error: string };

/** Hand out a fresh higher/lower pair (right player's value stays hidden). */
export async function nextHogerLager(roomId: string): Promise<HogerLagerRound> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  const a = randInt(STAT_PLAYERS.length);
  let b = randInt(STAT_PLAYERS.length);
  while (b === a) b = randInt(STAT_PLAYERS.length);

  const pa = STAT_PLAYERS[a];
  const pb = STAT_PLAYERS[b];
  return {
    ok: true,
    roundId: `${a}:${b}:${crypto.randomUUID()}`,
    left: { name: pa.name, flag: pa.flag, country: pa.country, position: pa.position, value: pa.value },
    right: { name: pb.name, flag: pb.flag, country: pb.country, position: pb.position },
  };
}

export type HogerLagerResult =
  | {
      ok: true;
      correct: boolean;
      leftValue: number;
      rightValue: number;
      coins: number;
      hourEarned: number;
    }
  | { ok: false; error: string };

/** Score a higher/lower call. Equal values count for both answers (fair). */
export async function guessHogerLager(
  input: HogerLagerGuessInput,
): Promise<HogerLagerResult> {
  const parsed = hogerLagerGuessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, roundId, choice } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.voetbal.unavailable };

  const [aStr, bStr] = roundId.split(":");
  const a = statPlayer(Number(aStr));
  const b = statPlayer(Number(bStr));
  if (!a || !b) return { ok: false, error: copy.common.genericError };

  const correct =
    choice === "higher" ? b.value >= a.value : b.value <= a.value;

  let coins = 0;
  let hourEarned = 0;
  if (correct) {
    const res = await awardVoetbalCapped(
      admin,
      access.userId,
      VOETBAL_HL_COINS,
      `hl:${roundId}`,
    );
    coins = res.coins;
    hourEarned = res.hourEarned;
  }

  return { ok: true, correct, leftValue: a.value, rightValue: b.value, coins, hourEarned };
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

export type QuizRound =
  | {
      ok: true;
      roundId: string;
      question: string;
      options: { id: number; text: string }[];
    }
  | { ok: false; error: string };

/** Pick a question; options are shuffled but each keeps its canonical id. */
export async function nextQuiz(roomId: string): Promise<QuizRound> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  const qi = randInt(QUIZ_QUESTIONS.length);
  const question = QUIZ_QUESTIONS[qi];
  const options = question.options.map((text, id) => ({ id, text }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    ok: true,
    roundId: `${qi}:${crypto.randomUUID()}`,
    question: question.q,
    options,
  };
}

export type QuizResult =
  | {
      ok: true;
      correct: boolean;
      correctId: number;
      coins: number;
      hourEarned: number;
    }
  | { ok: false; error: string };

/** Score a quiz answer against the question's hidden correct option. */
export async function answerQuiz(input: QuizAnswerInput): Promise<QuizResult> {
  const parsed = quizAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, roundId, optionId } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.voetbal.unavailable };

  const question = quizQuestion(Number(roundId.split(":")[0]));
  if (!question) return { ok: false, error: copy.common.genericError };

  const correct = optionId === question.correct;
  let coins = 0;
  let hourEarned = 0;
  if (correct) {
    const res = await awardVoetbalCapped(
      admin,
      access.userId,
      VOETBAL_QUIZ_COINS,
      `quiz:${roundId}`,
    );
    coins = res.coins;
    hourEarned = res.hourEarned;
  }

  return { ok: true, correct, correctId: question.correct, coins, hourEarned };
}

// ── Raad de speler (mystery) ──────────────────────────────────────────────────

export type MysteryRound =
  | { ok: true; roundId: string; clues: string[] }
  | { ok: false; error: string };

/** Build progressive clues for a hidden player (name never sent up front). */
export async function nextMystery(roomId: string): Promise<MysteryRound> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  const pi = randInt(STAT_PLAYERS.length);
  const p = STAT_PLAYERS[pi];
  const clues = [
    `${copy.voetbal.mystery.country}: ${p.flag} ${p.country}`,
    `${copy.voetbal.mystery.position}: ${p.position}`,
    `${copy.voetbal.mystery.clubs}: ${p.clubs.join(" → ")}`,
    `${copy.voetbal.mystery.value}: €${p.value}M`,
    `${copy.voetbal.mystery.initialsLabel}: ${initials(p.name)}`,
  ];
  return { ok: true, roundId: `${pi}:${crypto.randomUUID()}`, clues };
}

export type MysteryResult =
  | { ok: true; correct: boolean; name?: string; coins: number; hourEarned: number }
  | { ok: false; error: string };

/** Score a mystery guess; reveals the name only on a correct solve. */
export async function guessMystery(
  input: MysteryGuessInput,
): Promise<MysteryResult> {
  const parsed = mysteryGuessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, roundId, guess } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.voetbal.unavailable };

  const p = statPlayer(Number(roundId.split(":")[0]));
  if (!p) return { ok: false, error: copy.common.genericError };

  const correct = matchGuess([{ accept: p.accept }], guess) === 0;
  if (!correct) {
    return { ok: true, correct: false, coins: 0, hourEarned: 0 };
  }

  const { coins, hourEarned } = await awardVoetbalCapped(
    admin,
    access.userId,
    VOETBAL_MYSTERY_COINS,
    `mystery:${roundId}`,
  );
  return { ok: true, correct: true, name: p.name, coins, hourEarned };
}

/** Reveal a mystery's answer when the player gives up (pays nothing). */
export async function revealMystery(
  roundId: string,
): Promise<{ ok: true; name: string } | { ok: false }> {
  const p = statPlayer(Number(roundId.split(":")[0]));
  if (!p) return { ok: false };
  return { ok: true, name: p.name };
}
