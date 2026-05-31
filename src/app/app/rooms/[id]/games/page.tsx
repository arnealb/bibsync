import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoomWealth } from "@/components/bibcoins/room-wealth";
import { GameCard } from "@/components/games/game-card";
import { Leaderboard } from "@/components/games/leaderboard";
import { SessionLeaderboard } from "@/components/games/session-leaderboard";
import { copy } from "@/lib/copy";
import { getBibcoins, getRoomWealth } from "@/lib/bibcoins/queries";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { getSessionStandings } from "@/lib/games/session-queries";
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

  const [snakeBest, snakeBoard, showCheated, balance, petBest, sessions, wealth] =
    await Promise.all([
      getMyBestScore(id, access.userId, "snake"),
      getRoomLeaderboard(id, "snake"),
      getShowCheated(id),
      getBibcoins(access.userId),
      getMyBestScore(id, access.userId, "petconnect"),
      getSessionStandings(id),
      getRoomWealth(id),
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
        <GameCard
          href={`/app/rooms/${id}/games/poker`}
          title={copy.games.poker.title}
          subtitle={copy.games.poker.subtitle}
          emoji="🃏"
          myBest={balance}
          statLabel={copy.games.poker.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/blackjack`}
          title={copy.blackjack.title}
          subtitle={copy.blackjack.subtitle}
          emoji="♠️"
          myBest={balance}
          statLabel={copy.blackjack.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/roulette`}
          title={copy.roulette.title}
          subtitle={copy.roulette.subtitle}
          emoji="🎰"
          myBest={balance}
          statLabel={copy.roulette.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/mines`}
          title={copy.mines.title}
          subtitle={copy.mines.subtitle}
          emoji="💣"
          myBest={balance}
          statLabel={copy.mines.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/lottery`}
          title={copy.lottery.title}
          subtitle={copy.lottery.subtitle}
          emoji="🎟️"
          myBest={balance}
          statLabel={copy.lottery.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/crash`}
          title={copy.crash.title}
          subtitle={copy.crash.subtitle}
          emoji="🚀"
          myBest={balance}
          statLabel={copy.crash.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/dice`}
          title={copy.dice.title}
          subtitle={copy.dice.subtitle}
          emoji="🎲"
          myBest={balance}
          statLabel={copy.dice.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/plinko`}
          title={copy.plinko.title}
          subtitle={copy.plinko.subtitle}
          emoji="🔵"
          myBest={balance}
          statLabel={copy.plinko.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/petconnect`}
          title={copy.petconnect.title}
          subtitle={copy.petconnect.subtitle}
          emoji="🐾"
          myBest={petBest}
          statLabel={copy.petconnect.stat}
        />
      </div>

      <RoomWealth entries={wealth} />

      <SessionLeaderboard standings={sessions} />

      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        roomId={id}
        full={snakeBoard.full}
        honest={snakeBoard.honest}
        initialShowCheated={showCheated}
        masterReward={75}
      />
    </div>
  );
}
