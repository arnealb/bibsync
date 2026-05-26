import { notFound } from "next/navigation";

import { LastRoomTracker } from "@/components/rooms/last-room-tracker";
import { RoomPageHeader } from "@/components/rooms/room-page-header";
import { RoomTabs } from "@/components/rooms/room-tabs";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface RoomLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function RoomLayout({
  children,
  params,
}: RoomLayoutProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const members = await getRoomMembers(id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LastRoomTracker roomId={id} />
      <RoomPageHeader
        roomId={access.room.id}
        roomName={access.room.name}
        roomDescription={access.room.description}
        joinCode={access.room.join_code}
        isOwner={access.isOwner}
        memberCount={members.length}
      />
      <RoomTabs roomId={access.room.id} />
      {children}
    </div>
  );
}
