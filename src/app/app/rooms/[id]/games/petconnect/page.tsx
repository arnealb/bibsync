import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { PetConnectBoard } from "@/components/petconnect/petconnect-board";
import { getRoomLeaderboard, getShowCheated } from "@/lib/games/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface PetConnectPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PetConnectPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.petconnect.title} · ${access.room.name}`
      : copy.petconnect.title,
  };
}

export default async function PetConnectPage({ params }: PetConnectPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [board, showCheated] = await Promise.all([
    getRoomLeaderboard(id, "petconnect"),
    getShowCheated(id),
  ]);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.petconnect.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.petconnect.subtitle}
        </p>
      </div>
      <PetConnectBoard roomId={id} seed={seed} />
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.petconnect.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
      />
    </div>
  );
}
