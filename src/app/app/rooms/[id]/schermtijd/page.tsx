import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Coins } from "lucide-react";

import { ScreenTimeBoard } from "@/components/screen-time/screen-time-board";
import { ScreenTimeChart } from "@/components/screen-time/screen-time-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SCREEN_TIME_COINS_PER_MINUTE } from "@/lib/bibcoins/config";
import { copy } from "@/lib/copy";
import { getRoomScreenTime } from "@/lib/screen-time/queries";
import { formatScreenTime } from "@/lib/screen-time/format";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface ScreenTimePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ScreenTimePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.screenTime.title} · ${access.room.name}`
      : copy.screenTime.title,
  };
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
        {icon}
        {value}
      </p>
    </div>
  );
}

export default async function ScreenTimePage({ params }: ScreenTimePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const overview = await getRoomScreenTime(id);
  const topMember = overview.members.find((m) => m.totalSeconds > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.screenTime.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.screenTime.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label={copy.screenTime.totalTime}
          value={formatScreenTime(overview.roomTotalSeconds)}
        />
        <StatCard
          label={copy.screenTime.totalCoins}
          value={String(overview.roomTotalCoins)}
          icon={<Coins className="size-5 text-amber-500" />}
        />
        <StatCard
          label={copy.screenTime.mostActive}
          value={topMember ? topMember.name : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {copy.screenTime.chartTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.screenTime.chartSubtitle}
          </p>
        </CardHeader>
        <CardContent>
          <ScreenTimeChart daily={overview.daily} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {copy.screenTime.boardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScreenTimeBoard
            members={overview.members}
            currentUserId={access.userId}
          />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {copy.screenTime.reward(SCREEN_TIME_COINS_PER_MINUTE)}
      </p>
    </div>
  );
}
