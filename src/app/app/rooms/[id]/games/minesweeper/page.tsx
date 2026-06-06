import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArcadeCapBar } from "@/components/games/arcade-cap-bar";
import { Leaderboard } from "@/components/games/leaderboard";
import { MinesweeperGame } from "@/components/games/minesweeper/minesweeper-game";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import type { MinesweeperDifficulty } from "@/lib/games/minesweeper/engine";
import { MINESWEEPER_GAME_KEYS } from "@/lib/games/minesweeper/keys";
import {
  getMyBestTime,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

const DIFFICULTIES: MinesweeperDifficulty[] = ["easy", "medium", "hard"];

interface MinesweeperPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MinesweeperPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.minesweeper.title} · ${access.room.name}`
      : copy.games.minesweeper.title,
  };
}

export default async function MinesweeperPage({
  params,
}: MinesweeperPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [bestTimes, boards, showCheated] = await Promise.all([
    Promise.all(
      DIFFICULTIES.map((d) =>
        getMyBestTime(id, access.userId, MINESWEEPER_GAME_KEYS[d]),
      ),
    ),
    Promise.all(
      DIFFICULTIES.map((d) => getRoomLeaderboard(id, MINESWEEPER_GAME_KEYS[d])),
    ),
    getShowCheated(id),
  ]);
  const myBestTimes = Object.fromEntries(
    DIFFICULTIES.map((d, i) => [d, bestTimes[i]]),
  ) as Record<MinesweeperDifficulty, number | null>;

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.minesweeper.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.minesweeper.subtitle}
          </p>
        </div>
        <ArcadeCapBar />
        <MinesweeperGame roomId={id} myBestTimes={myBestTimes} />
      </section>
      <div className="space-y-4">
        {DIFFICULTIES.map((difficulty, i) => (
          <Leaderboard
            key={difficulty}
            title={`${copy.games.leaderboard} — ${copy.games.minesweeper.title} (${copy.games.minesweeper.difficulty[difficulty]})`}
            roomId={id}
            full={boards[i].full}
            honest={boards[i].honest}
            initialShowCheated={showCheated}
            kingReward={GAME_KING_REWARD}
            kingLabel={`${copy.games.king.minesweeper} (${copy.games.minesweeper.difficulty[difficulty]})`}
            timeOnly
          />
        ))}
      </div>
    </div>
  );
}
