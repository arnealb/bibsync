import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoomWealth } from "@/components/bibcoins/room-wealth";
import { GameCard } from "@/components/games/game-card";
import { Leaderboard } from "@/components/games/leaderboard";
import { SessionLeaderboard } from "@/components/games/session-leaderboard";
import { copy } from "@/lib/copy";
import { getBibcoins, getRoomWealth } from "@/lib/bibcoins/queries";
import { SNAKE_KING_REWARD } from "@/lib/games/constants";
import { MINESWEEPER_GAME_KEYS } from "@/lib/games/minesweeper/keys";
import {
  getMyBestScore,
  getMyBestTime,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { mmss } from "@/lib/games/rank";
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

  const [
    snakeBest,
    snakeBoard,
    showCheated,
    balance,
    petBest,
    sessions,
    wealth,
    flappyBest,
    tetrisBest,
    twenty48Best,
    statesBest,
    minesweeperTimes,
  ] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
    getShowCheated(id),
    getBibcoins(access.userId),
    getMyBestScore(id, access.userId, "petconnect"),
    getSessionStandings(id),
    getRoomWealth(id),
    getMyBestScore(id, access.userId, "flappy"),
    getMyBestScore(id, access.userId, "tetris"),
    getMyBestScore(id, access.userId, "2048"),
    getMyBestScore(id, access.userId, "usstates"),
    Promise.all(
      (["easy", "medium", "hard"] as const).map((d) =>
        getMyBestTime(id, access.userId, MINESWEEPER_GAME_KEYS[d]),
      ),
    ),
  ]);

  // "0:45 · 2:10 · —": the fastest win per difficulty (easy/normaal/moeilijk).
  const minesweeperBestDisplay = minesweeperTimes
    .map((t) => (t === null ? "—" : mmss(t)))
    .join(" · ");

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
          href={`/app/rooms/${id}/games/flappy`}
          title={copy.games.flappy.title}
          subtitle={copy.games.flappy.subtitle}
          emoji="🐤"
          myBest={flappyBest}
        />
        <GameCard
          href={`/app/rooms/${id}/games/tetris`}
          title={copy.games.tetris.title}
          subtitle={copy.games.tetris.subtitle}
          emoji="🧩"
          myBest={tetrisBest}
        />
        <GameCard
          href={`/app/rooms/${id}/games/2048`}
          title={copy.games.twenty48.title}
          subtitle={copy.games.twenty48.subtitle}
          emoji="🧮"
          myBest={twenty48Best}
        />
        <GameCard
          href={`/app/rooms/${id}/games/usstates`}
          title={copy.usstates.title}
          subtitle={copy.usstates.subtitle}
          emoji="🇺🇸"
          myBest={statesBest}
          statLabel={copy.usstates.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/minesweeper`}
          title={copy.games.minesweeper.title}
          subtitle={copy.games.minesweeper.subtitle}
          emoji="🚩"
          myBest={null}
          myBestDisplay={minesweeperBestDisplay}
          statLabel={copy.games.minesweeper.bestTimes}
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
          href={`/app/rooms/${id}/games/merge`}
          title={copy.games.merge.title}
          subtitle={copy.games.merge.subtitle}
          emoji="🌳"
          myBest={null}
        />
        <GameCard
          href={`/app/rooms/${id}/games/hilo`}
          title={copy.hilo.title}
          subtitle={copy.hilo.subtitle}
          emoji="🎴"
          myBest={balance}
          statLabel={copy.hilo.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/keno`}
          title={copy.keno.title}
          subtitle={copy.keno.subtitle}
          emoji="🔢"
          myBest={balance}
          statLabel={copy.keno.stat}
        />
        <GameCard
          href={`/app/rooms/${id}/games/wheel`}
          title={copy.wheel.title}
          subtitle={copy.wheel.subtitle}
          emoji="🎡"
          myBest={balance}
          statLabel={copy.wheel.stat}
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
          href={`/app/rooms/${id}/games/mexen`}
          title={copy.mexen.title}
          subtitle={copy.mexen.subtitle}
          emoji="🌮"
          myBest={balance}
          statLabel={copy.mexen.stat}
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
          href={`/app/rooms/${id}/games/stock`}
          title={copy.stock.title}
          subtitle={copy.stock.subtitle}
          emoji="📈"
          myBest={balance}
          statLabel={copy.stock.stat}
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
        kingReward={SNAKE_KING_REWARD}
      />
    </div>
  );
}
