import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StrijderPopup } from "@/components/bibcoins/strijder-popup";
import { PilloryBanner } from "@/components/rooms/pillory-banner";
import { getRoomPillory } from "@/lib/rooms/pillory-queries";
import { InstantBreakPanel } from "@/components/instant-break/instant-break-panel";
import { PresenceSidebar } from "@/components/presence/presence-sidebar";
import { RestoMenuCard } from "@/components/resto/resto-menu-card";
import { getStrijderClaimable } from "@/lib/bibcoins/queries";
import { getRestoMenu } from "@/lib/resto/api";
import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import {
  getActiveInstantBreak,
  getRecentPushes,
} from "@/lib/instant-break/queries";
import { toMemberMap } from "@/lib/members";
import { getRoomPresence } from "@/lib/presence/queries";
import { getRoomComments } from "@/lib/proposals/comments-queries";
import { getFoodBets } from "@/lib/proposals/food-bets-queries";
import { getRoomPlaces, getRoomProposals } from "@/lib/proposals/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";
import { todayInBrussels } from "@/lib/time";

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

  const today = todayInBrussels();

  const [
    members,
    proposalsData,
    presenceRows,
    comments,
    activeBreak,
    recentPushes,
    places,
    foodBets,
    strijderClaimable,
    pillory,
    restoMenu,
  ] = await Promise.all([
    getRoomMembers(id),
    getRoomProposals(id),
    getRoomPresence(id),
    getRoomComments(id),
    getActiveInstantBreak(id),
    getRecentPushes(id),
    getRoomPlaces(id),
    getFoodBets(id),
    getStrijderClaimable(access.userId),
    getRoomPillory(id),
    getRestoMenu(today),
  ]);

  const memberMap = toMemberMap(members);
  const memberOptions = members.map((member) => ({
    id: member.user_id,
    name: member.profile?.display_name ?? "—",
    avatarUrl: member.profile?.avatar_url ?? null,
    loadout: member.loadout,
  }));

  return (
    <div className="space-y-4">
      <StrijderPopup initialClaimable={strijderClaimable} />
      <PilloryBanner
        roomId={access.room.id}
        userId={access.userId}
        members={memberMap}
        initialEntries={pillory}
      />
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
            initialPresence={presenceRows}
            initialFoodBets={foodBets}
            today={today}
          />
        }
        presenceSlot={
          <>
            <PresenceSidebar
              roomId={access.room.id}
              userId={access.userId}
              members={memberOptions}
              initialPresence={presenceRows}
              hasLocation={access.room.lat != null && access.room.lng != null}
              canManage={access.canManage}
              today={today}
            />
            <RestoMenuCard menu={restoMenu} />
          </>
        }
      />
    </div>
  );
}
