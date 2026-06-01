import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HiloPanel } from "@/components/hilo/hilo-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getHiloGame } from "@/lib/hilo/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface HiloPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: HiloPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.hilo.title} · ${access.room.name}` : copy.hilo.title,
  };
}

export default async function HiloPage({ params }: HiloPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [game, balance] = await Promise.all([
    getHiloGame(id, access.userId),
    getBibcoins(access.userId),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.hilo.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.hilo.subtitle}</p>
      </div>
      <HiloPanel roomId={id} initialState={game} initialBalance={balance} />
    </div>
  );
}
