import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat/chat-panel";
import { PresenceSidebar } from "@/components/presence/presence-sidebar";
import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import { getRoomMessages } from "@/lib/messages/queries";
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

  const [members, proposalsData, presenceRows, messagesData, comments] =
    await Promise.all([
      getRoomMembers(id),
      getRoomProposals(id),
      getRoomPresence(id),
      getRoomMessages(id),
      getRoomComments(id),
    ]);

  const memberNames: Record<string, string> = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      member.profile?.display_name ?? "—",
    ]),
  );

  const memberOptions = members.map((member) => ({
    id: member.user_id,
    name: member.profile?.display_name ?? "—",
  }));

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
      chatSlot={
        <ChatPanel
          roomId={access.room.id}
          userId={access.userId}
          members={memberNames}
          initialMessages={messagesData.messages}
          initialHasMore={messagesData.hasMore}
        />
      }
    />
  );
}
