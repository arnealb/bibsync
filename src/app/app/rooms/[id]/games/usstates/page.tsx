import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UsStatesGame } from "@/components/games/usstates/usstates-game";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getMyBestScore } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface UsStatesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UsStatesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.usstates.title} · ${access.room.name}`
      : copy.usstates.title,
  };
}

export default async function UsStatesPage({ params }: UsStatesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [balance, myBest] = await Promise.all([
    getBibcoins(access.userId),
    getMyBestScore(id, access.userId, "usstates"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.usstates.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.usstates.subtitle}</p>
      </div>
      <UsStatesGame roomId={id} initialBalance={balance} myBest={myBest} />
    </div>
  );
}
