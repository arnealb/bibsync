import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GameCard } from "@/components/games/game-card";
import { Leaderboard } from "@/components/games/leaderboard";
import { copy } from "@/lib/copy";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { getPokerTable } from "@/lib/poker/queries";
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

  const [snakeBest, snakeBoard, pokerTable, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
    getPokerTable(id),
    getShowCheated(id),
  ]);

  const myChips =
    pokerTable?.players.find((p) => p.userId === access.userId)?.chips ?? null;

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
        <GameCard
          href={`/app/rooms/${id}/games/poker`}
          title={copy.games.poker.title}
          subtitle={copy.games.poker.subtitle}
          emoji="🃏"
          myBest={myChips}
          statLabel={copy.games.poker.stat}
        />
      </div>

      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        roomId={id}
        full={snakeBoard.full}
        honest={snakeBoard.honest}
        initialShowCheated={showCheated}
      />
    </div>
  );
}
