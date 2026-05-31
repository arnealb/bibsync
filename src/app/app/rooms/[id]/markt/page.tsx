import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketplacePanel } from "@/components/marketplace/marketplace-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getRoomBids, getRoomOffers } from "@/lib/marketplace/queries";
import type { MemberMap } from "@/lib/members";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface MarktPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MarktPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.marketplace.title} · ${access.room.name}`
      : copy.marketplace.title,
  };
}

export default async function MarktPage({ params }: MarktPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [offers, bids, balance, members] = await Promise.all([
    getRoomOffers(id),
    getRoomBids(id),
    getBibcoins(access.userId),
    getRoomMembers(id),
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

  return (
    <div className="mx-auto max-w-xl">
      <MarketplacePanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialOffers={offers}
        initialBids={bids}
        initialBalance={balance}
      />
    </div>
  );
}
