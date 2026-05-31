import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LotteryPanel } from "@/components/lottery/lottery-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getLotteryRound } from "@/lib/lottery/queries";
import { toMemberMap } from "@/lib/members";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface LotteryPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: LotteryPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.lottery.title} · ${access.room.name}`
      : copy.lottery.title,
  };
}

export default async function LotteryPage({ params }: LotteryPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [round, balance, members] = await Promise.all([
    getLotteryRound(id),
    getBibcoins(access.userId),
    getRoomMembers(id),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.lottery.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.lottery.subtitle}</p>
      </div>
      <LotteryPanel
        roomId={id}
        userId={access.userId}
        members={toMemberMap(members)}
        initialState={round}
        initialBalance={balance}
      />
    </div>
  );
}
