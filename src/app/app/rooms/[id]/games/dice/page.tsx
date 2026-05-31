import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DicePanel } from "@/components/dice/dice-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface DicePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DicePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.dice.title} · ${access.room.name}`
      : copy.dice.title,
  };
}

export default async function DicePage({ params }: DicePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const balance = await getBibcoins(access.userId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.dice.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.dice.subtitle}</p>
      </div>
      <DicePanel roomId={id} initialBalance={balance} />
    </div>
  );
}
