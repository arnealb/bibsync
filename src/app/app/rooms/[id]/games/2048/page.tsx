import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArcadeCapBar } from "@/components/games/arcade-cap-bar";
import { Leaderboard } from "@/components/games/leaderboard";
import { Game2048 } from "@/components/games/twenty48/twenty48-game";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface Game2048PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: Game2048PageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.twenty48.title} · ${access.room.name}`
      : copy.games.twenty48.title,
  };
}

export default async function Game2048Page({ params }: Game2048PageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "2048"),
    getRoomLeaderboard(id, "2048"),
    getShowCheated(id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.twenty48.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.twenty48.subtitle}
          </p>
        </div>
        <ArcadeCapBar />
        <Game2048 roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.twenty48.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.twenty48}
      />
    </div>
  );
}
