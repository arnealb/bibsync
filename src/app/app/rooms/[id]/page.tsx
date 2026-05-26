import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PresenceSidebar } from "@/components/presence/presence-sidebar";
import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { getRoomPresence } from "@/lib/presence/queries";
import { getRoomComments } from "@/lib/proposals/comments-queries";
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

  const [members, proposalsData, presenceRows, comments] = await Promise.all([
    getRoomMembers(id),
    getRoomProposals(id),
    getRoomPresence(id),
    getRoomComments(id),
  ]);

  const memberMap: MemberMap = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  const memberOptions = members.map((member) => ({
    id: member.user_id,
    name: member.profile?.display_name ?? "—",
    avatarUrl: member.profile?.avatar_url ?? null,
  }));

  return (
    <RoomDashboard
      breaksSlot={
        <ProposalsPanel
          roomId={access.room.id}
          userId={access.userId}
          members={memberMap}
          initialProposals={proposalsData.proposals}
          initialVotes={proposalsData.votes}
          initialComments={comments}
        />
      }
      presenceSlot={
        <PresenceSidebar
          roomId={access.room.id}
          userId={access.userId}
          members={memberOptions}
          initialPresence={presenceRows}
        />
      }
    />
  );
}
