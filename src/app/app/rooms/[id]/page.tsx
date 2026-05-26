import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InstantBreakPanel } from "@/components/instant-break/instant-break-panel";
import { PresenceSidebar } from "@/components/presence/presence-sidebar";
import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { getLoadouts } from "@/lib/cosmetics/queries";
import { resolveLoadout } from "@/lib/cosmetics/resolve";
import { copy } from "@/lib/copy";
import {
  getActiveInstantBreak,
  getRecentPushes,
} from "@/lib/instant-break/queries";
import type { MemberMap } from "@/lib/members";
import { getRoomPresence } from "@/lib/presence/queries";
import { getRoomComments } from "@/lib/proposals/comments-queries";
import { getRoomPlaces, getRoomProposals } from "@/lib/proposals/queries";
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

  const [
    members,
    proposalsData,
    presenceRows,
    comments,
    activeBreak,
    recentPushes,
    places,
  ] = await Promise.all([
    getRoomMembers(id),
    getRoomProposals(id),
    getRoomPresence(id),
    getRoomComments(id),
    getActiveInstantBreak(id),
    getRecentPushes(id),
    getRoomPlaces(id),
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

  const loadouts = await getLoadouts(members.map((member) => member.user_id));
  const memberOptions = members.map((member) => ({
    id: member.user_id,
    name: member.profile?.display_name ?? "—",
    avatarUrl: member.profile?.avatar_url ?? null,
    loadout: resolveLoadout(loadouts[member.user_id]),
  }));

  return (
    <div className="space-y-4">
      <InstantBreakPanel
        roomId={access.room.id}
        userId={access.userId}
        members={memberMap}
        initialActiveBreak={activeBreak}
        initialPushes={recentPushes}
      />
      <RoomDashboard
        breaksSlot={
          <ProposalsPanel
            roomId={access.room.id}
            userId={access.userId}
            members={memberMap}
            initialProposals={proposalsData.proposals}
            initialVotes={proposalsData.votes}
            initialComments={comments}
            initialPlaces={places}
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
    </div>
  );
}
