import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PokerPanel } from "@/components/poker/poker-panel";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
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

  const memberMap: MemberMap = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href={`/app/rooms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {access.room.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {copy.poker.title}
        </h1>
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
