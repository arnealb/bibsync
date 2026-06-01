import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArcadeCapBar } from "@/components/games/arcade-cap-bar";
import { Leaderboard } from "@/components/games/leaderboard";
import { TetrisGame } from "@/components/games/tetris/tetris-game";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface TetrisPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TetrisPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.tetris.title} · ${access.room.name}`
      : copy.games.tetris.title,
  };
}

export default async function TetrisPage({ params }: TetrisPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "tetris"),
    getRoomLeaderboard(id, "tetris"),
    getShowCheated(id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.tetris.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.tetris.subtitle}
          </p>
        </div>
        <ArcadeCapBar />
        <TetrisGame roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.tetris.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.tetris}
      />
    </div>
  );
}
