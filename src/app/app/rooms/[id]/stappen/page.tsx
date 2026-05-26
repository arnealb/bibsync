import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { HealthSyncCard } from "@/components/steps/health-sync-card";
import { StepCounter } from "@/components/steps/step-counter";
import { StepsLeaderboard } from "@/components/steps/steps-leaderboard";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { getHealthToken, getStepsBoard } from "@/lib/steps/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";
import { todayInBrussels } from "@/lib/time";

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

  const [board, token, members, headerList] = await Promise.all([
    getStepsBoard(id, access.userId),
    getHealthToken(access.userId),
    getRoomMembers(id),
    headers(),
  ]);

  const memberMap: MemberMap = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  const host = headerList.get("host") ?? "";
  const endpoint = host ? `https://${host}/api/steps` : "/api/steps";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.steps.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.steps.subtitle}</p>
      </div>

      <StepCounter roomId={id} />

      <StepsLeaderboard
        roomId={id}
        today={todayInBrussels()}
        members={memberMap}
        initialToday={board.today}
        initialAllTime={board.allTime}
      />

      <HealthSyncCard roomId={id} endpoint={endpoint} initialToken={token} />
    </div>
  );
}
