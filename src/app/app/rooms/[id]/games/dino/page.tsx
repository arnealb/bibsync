import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArcadeCapBar } from "@/components/games/arcade-cap-bar";
import { DinoGame } from "@/components/games/dino/dino-game";
import { Leaderboard } from "@/components/games/leaderboard";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import { getMyBestScore, getRoomLeaderboard } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface DinoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DinoPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.dino.title} · ${access.room.name}`
      : copy.games.dino.title,
  };
}

export default async function DinoPage({ params }: DinoPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board] = await Promise.all([
    getMyBestScore(id, access.userId, "dino"),
    getRoomLeaderboard(id, "dino"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.dino.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.dino.subtitle}
          </p>
        </div>
        <ArcadeCapBar />
        <DinoGame roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.dino.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={false}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.dino}
      />
    </div>
  );
}
