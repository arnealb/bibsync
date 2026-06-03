import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { UsStatesGame } from "@/components/games/usstates/usstates-game";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface UsStatesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UsStatesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.usstates.title} · ${access.room.name}`
      : copy.usstates.title,
  };
}

export default async function UsStatesPage({ params }: UsStatesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [balance, myBest, board, showCheated] = await Promise.all([
    getBibcoins(access.userId),
    getMyBestScore(id, access.userId, "usstates"),
    getRoomLeaderboard(id, "usstates"),
    getShowCheated(id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.usstates.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.usstates.subtitle}</p>
      </div>
      <UsStatesGame roomId={id} initialBalance={balance} myBest={myBest} />
      {/* The map needs the full column width, so the board sits below it
          instead of in the side-by-side grid the fixed-width games use. */}
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.usstates.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.usstates}
      />
    </div>
  );
}
