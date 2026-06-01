import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArcadeCapBar } from "@/components/games/arcade-cap-bar";
import { FlappyGame } from "@/components/games/flappy/flappy-game";
import { Leaderboard } from "@/components/games/leaderboard";
import { copy } from "@/lib/copy";
import { getMyBestScore, getRoomLeaderboard } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface FlappyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: FlappyPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.flappy.title} · ${access.room.name}`
      : copy.games.flappy.title,
  };
}

export default async function FlappyPage({ params }: FlappyPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board] = await Promise.all([
    getMyBestScore(id, access.userId, "flappy"),
    getRoomLeaderboard(id, "flappy"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.flappy.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.flappy.subtitle}
          </p>
        </div>
        <ArcadeCapBar />
        <FlappyGame roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.flappy.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={false}
      />
    </div>
  );
}
