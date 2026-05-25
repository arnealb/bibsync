import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RoomPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return { title: access?.room.name ?? copy.rooms.listTitle };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const members = await getRoomMembers(id);

  return (
    <RoomDashboard
      roomId={access.room.id}
      roomName={access.room.name}
      roomDescription={access.room.description}
      joinCode={access.room.join_code}
      isOwner={access.isOwner}
      memberCount={members.length}
      statusSlot={null}
      breaksSlot={
        <p className="text-sm text-muted-foreground">{copy.proposals.empty}</p>
      }
      presenceSlot={
        <p className="text-sm text-muted-foreground">{copy.presence.empty}</p>
      }
    />
  );
}
