import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { SnakeGame } from "@/components/games/snake/snake-game";
import { copy } from "@/lib/copy";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface SnakePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SnakePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.snake.title} · ${access.room.name}`
      : copy.games.snake.title,
  };
}

export default async function SnakePage({ params }: SnakePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
    getShowCheated(id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.snake.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.snake.subtitle}
          </p>
        </div>
        <SnakeGame roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
      />
    </div>
  );
}
