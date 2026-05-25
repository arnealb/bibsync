import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import { getRoomProposals } from "@/lib/proposals/queries";
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

  const [members, proposalsData] = await Promise.all([
    getRoomMembers(id),
    getRoomProposals(id),
  ]);

  const memberNames: Record<string, string> = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      member.profile?.display_name ?? "—",
    ]),
  );

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
        <ProposalsPanel
          roomId={access.room.id}
          userId={access.userId}
          members={memberNames}
          initialProposals={proposalsData.proposals}
          initialVotes={proposalsData.votes}
        />
      }
      presenceSlot={
        <p className="text-sm text-muted-foreground">{copy.presence.empty}</p>
      }
    />
  );
}
