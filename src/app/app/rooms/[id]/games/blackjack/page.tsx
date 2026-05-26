import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlackjackPanel } from "@/components/blackjack/blackjack-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { getBlackjackPublic } from "@/lib/blackjack/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface BlackjackPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: BlackjackPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.blackjack.title} · ${access.room.name}`
      : copy.blackjack.title,
  };
}

export default async function BlackjackPage({ params }: BlackjackPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [state, balance] = await Promise.all([
    getBlackjackPublic(access.userId),
    getBibcoins(access.userId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.blackjack.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.blackjack.subtitle}
        </p>
      </div>
      <BlackjackPanel initialState={state} initialBalance={balance} />
    </div>
  );
}
