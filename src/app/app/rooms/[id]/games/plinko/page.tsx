import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlinkoPanel } from "@/components/plinko/plinko-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface PlinkoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PlinkoPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.plinko.title} · ${access.room.name}`
      : copy.plinko.title,
  };
}

export default async function PlinkoPage({ params }: PlinkoPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const balance = await getBibcoins(access.userId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.plinko.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.plinko.subtitle}</p>
      </div>
      <PlinkoPanel roomId={id} initialBalance={balance} />
    </div>
  );
}
