import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MexenPanel } from "@/components/mexen/mexen-panel";
import { copy } from "@/lib/copy";
import type { MexenPlayer } from "@/lib/mexen/game";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface MexenPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MexenPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.mexen.title} · ${access.room.name}`
      : copy.mexen.title,
  };
}

export default async function MexenPage({ params }: MexenPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const members = await getRoomMembers(id);
  const players: MexenPlayer[] = members
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.user_id,
      name: m.profile!.display_name,
      avatarUrl: m.profile!.avatar_url,
      loadout: m.loadout,
    }));

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.mexen.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.mexen.subtitle}</p>
      </div>
      <MexenPanel roomId={id} members={players} />
    </div>
  );
}
