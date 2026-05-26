import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GameCard } from "@/components/games/game-card";
import { Leaderboard } from "@/components/games/leaderboard";
import { copy } from "@/lib/copy";
import { getMyBestScore, getRoomLeaderboard } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface GamesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: GamesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.games.title} · ${access.room.name}` : copy.games.title,
  };
}

export default async function GamesPage({ params }: GamesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [snakeBest, snakeBoard] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.games.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.games.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GameCard
          href={`/app/rooms/${id}/games/snake`}
          title={copy.games.snake.title}
          subtitle={copy.games.snake.subtitle}
          emoji="🐍"
          myBest={snakeBest}
        />
      </div>

      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        entries={snakeBoard}
      />
    </div>
  );
}
