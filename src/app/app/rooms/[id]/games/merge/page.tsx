import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMergeBoard } from "@/app/_actions/merge";
import { MergeValley } from "@/components/games/merge/merge-valley";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface MergePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MergePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.merge.title} · ${access.room.name}`
      : copy.merge.title,
  };
}

export default async function MergePage({ params }: MergePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const board = await getMergeBoard({ roomId: id });
  if (!board.ok) notFound();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.merge.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.merge.subtitle}</p>
      </div>
      <MergeValley
        roomId={id}
        initialState={board.state}
        initialBalance={board.balance}
      />
    </div>
  );
}
