import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PokerPanel } from "@/components/poker/poker-panel";
import { copy } from "@/lib/copy";
import { toMemberMap } from "@/lib/members";
import { getMyHoleCards, getPokerTable } from "@/lib/poker/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface PokerPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PokerPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.poker.title} · ${access.room.name}`
      : copy.poker.title,
  };
}

export default async function PokerPage({ params }: PokerPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [members, table] = await Promise.all([
    getRoomMembers(id),
    getPokerTable(id),
  ]);

  const initialHand =
    table && table.status !== "waiting"
      ? await getMyHoleCards(id, table.handNo, access.userId)
      : null;

  const memberMap = toMemberMap(members);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.poker.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.poker.subtitle}</p>
      </div>
      <PokerPanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialState={table}
        initialHand={initialHand}
      />
    </div>
  );
}
