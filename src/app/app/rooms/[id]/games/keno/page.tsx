import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KenoPanel } from "@/components/keno/keno-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface KenoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: KenoPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.keno.title} · ${access.room.name}` : copy.keno.title,
  };
}

export default async function KenoPage({ params }: KenoPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const balance = await getBibcoins(access.userId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.keno.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.keno.subtitle}</p>
      </div>
      <KenoPanel roomId={id} initialBalance={balance} />
    </div>
  );
}
