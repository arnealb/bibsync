import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoulettePanel } from "@/components/roulette/roulette-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { toMemberMap } from "@/lib/members";
import { getRouletteTable } from "@/lib/roulette/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface RoulettePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RoulettePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.roulette.title} · ${access.room.name}`
      : copy.roulette.title,
  };
}

export default async function RoulettePage({ params }: RoulettePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [table, balance, members] = await Promise.all([
    getRouletteTable(id),
    getBibcoins(access.userId),
    getRoomMembers(id),
  ]);

  const memberMap = toMemberMap(members);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.roulette.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.roulette.subtitle}
        </p>
      </div>
      <RoulettePanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialState={table}
        initialBalance={balance}
      />
    </div>
  );
}
