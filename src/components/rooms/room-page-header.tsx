import { RoomActions } from "@/components/rooms/room-actions";
import { copy } from "@/lib/copy";

interface RoomPageHeaderProps {
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  joinCode: string;
  isOwner: boolean;
  memberCount: number;
}

export function RoomPageHeader({
  roomId,
  roomName,
  roomDescription,
  joinCode,
  isOwner,
  memberCount,
}: RoomPageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">
          {roomName}
        </h1>
        {roomDescription && (
          <p className="text-sm text-muted-foreground">{roomDescription}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {copy.rooms.membersCount(memberCount)}
        </p>
      </div>
      <RoomActions roomId={roomId} joinCode={joinCode} isOwner={isOwner} />
    </div>
  );
}
