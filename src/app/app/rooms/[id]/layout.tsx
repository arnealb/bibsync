import { notFound } from "next/navigation";

import { LastRoomTracker } from "@/components/rooms/last-room-tracker";
import { RoomPageHeader } from "@/components/rooms/room-page-header";
import { RoomTabs } from "@/components/rooms/room-tabs";
import { TimeoutBanner } from "@/components/rooms/timeout-banner";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";
import { getRoomTimeouts } from "@/lib/timeouts/queries";

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

  const [members, timeouts] = await Promise.all([
    getRoomMembers(id),
    getRoomTimeouts(id),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LastRoomTracker roomId={id} />
      <TimeoutBanner
        roomId={id}
        userId={access.userId}
        initialTimedOut={timeouts.includes(access.userId)}
      />
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
