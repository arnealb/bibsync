import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  DAILY_BONUS,
  HOURLY_TRICKLE,
  REWARD,
} from "@/lib/bibcoins/config";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.bibcoins.earn.title };

const c = copy.bibcoins.earn;

interface EarnMethod {
  emoji: string;
  title: string;
  desc: string;
  amount: string;
}

const METHODS: EarnMethod[] = [
  {
    emoji: "🎁",
    title: c.methods.dailyTitle,
    desc: c.methods.dailyDesc,
    amount: c.perDay(DAILY_BONUS),
  },
  {
    emoji: "⏳",
    title: c.methods.hourlyTitle,
    desc: c.methods.hourlyDesc,
    amount: c.perHour(HOURLY_TRICKLE),
  },
  {
    emoji: "💡",
    title: c.methods.proposalTitle,
    desc: c.methods.proposalDesc,
    amount: c.flat(REWARD.createProposal),
  },
  {
    emoji: "💬",
    title: c.methods.commentTitle,
    desc: c.methods.commentDesc,
    amount: c.flat(REWARD.comment),
  },
  {
    emoji: "🗳️",
    title: c.methods.voteTitle,
    desc: c.methods.voteDesc,
    amount: c.flat(REWARD.vote),
  },
  {
    emoji: "💌",
    title: c.methods.chatTitle,
    desc: c.methods.chatDesc,
    amount: c.flat(REWARD.dailyChat),
  },
  {
    emoji: "🐍",
    title: c.methods.snakeTitle,
    desc: c.methods.snakeDesc,
    amount: c.perPoint(REWARD.snakeBestPerPoint),
  },
  {
    emoji: "🐶",
    title: c.methods.petTitle,
    desc: c.methods.petDesc,
    amount: c.flat(REWARD.petConnectDaily),
  },
  {
    emoji: "👟",
    title: c.methods.stepsTitle,
    desc: c.methods.stepsDesc,
    amount: c.per1000(REWARD.stepsPer1000),
  },
  {
    emoji: "🏆",
    title: c.methods.achievementsTitle,
    desc: c.methods.achievementsDesc,
    amount: c.bonus,
  },
];

export default function EarnPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href="/app/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {c.back}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      <ul className="divide-y rounded-lg border bg-card shadow-sm">
        {METHODS.map((method) => (
          <li
            key={method.title}
            className="flex items-center gap-3 p-3"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {method.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{method.title}</p>
              <p className="text-sm text-muted-foreground">{method.desc}</p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-500">
              {method.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
