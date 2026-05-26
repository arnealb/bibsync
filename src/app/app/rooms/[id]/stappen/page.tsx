import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { HealthSyncCard } from "@/components/steps/health-sync-card";
import { StepCounter } from "@/components/steps/step-counter";
import { StepsLeaderboard } from "@/components/steps/steps-leaderboard";
import { copy } from "@/lib/copy";
import { getHealthToken, getStepsBoard } from "@/lib/steps/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface StepsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: StepsPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.steps.title} · ${access.room.name}`
      : copy.steps.title,
  };
}

export default async function StepsPage({ params }: StepsPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [board, token, headerList] = await Promise.all([
    getStepsBoard(id, access.userId),
    getHealthToken(access.userId),
    headers(),
  ]);

  const host = headerList.get("host") ?? "";
  const endpoint = host ? `https://${host}/api/steps` : "/api/steps";
  const installUrl = process.env.NEXT_PUBLIC_SHORTCUT_URL ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.steps.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.steps.subtitle}</p>
      </div>

      <HealthSyncCard
        roomId={id}
        endpoint={endpoint}
        installUrl={installUrl}
        initialToken={token}
      />

      <StepsLeaderboard
        roomId={id}
        initialToday={board.today}
        initialAllTime={board.allTime}
      />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{copy.steps.manualTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {copy.steps.manualSubtitle}
          </p>
        </div>
        <StepCounter roomId={id} />
      </div>
    </div>
  );
}
