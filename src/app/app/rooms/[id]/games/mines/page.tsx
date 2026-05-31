import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MinesPanel } from "@/components/mines/mines-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getMinesGame } from "@/lib/mines/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface MinesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MinesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.mines.title} · ${access.room.name}`
      : copy.mines.title,
  };
}

export default async function MinesPage({ params }: MinesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [game, balance] = await Promise.all([
    getMinesGame(id, access.userId),
    getBibcoins(access.userId),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.mines.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.mines.subtitle}</p>
      </div>
      <MinesPanel roomId={id} initialState={game} initialBalance={balance} />
    </div>
  );
}
