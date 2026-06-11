import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HorsesPanel } from "@/components/horses/horses-panel";
import { copy } from "@/lib/copy";
import { getHorsesState } from "@/lib/horses/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface HorsesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: HorsesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.horses.title} · ${access.room.name}`
      : copy.horses.title,
  };
}

export default async function HorsesPage({ params }: HorsesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const state = await getHorsesState(access.userId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.horses.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.horses.subtitle}</p>
      </div>
      <HorsesPanel roomId={id} userId={access.userId} initial={state} />
    </div>
  );
}
