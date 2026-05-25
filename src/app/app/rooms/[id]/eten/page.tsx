import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FoodPanel } from "@/components/food/food-panel";
import { copy } from "@/lib/copy";
import { getRoomFood } from "@/lib/food/queries";
import type { MemberMap } from "@/lib/members";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface FoodPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: FoodPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.food.title} · ${access.room.name}` : copy.food.title,
  };
}

export default async function FoodPage({ params }: FoodPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [members, food] = await Promise.all([
    getRoomMembers(id),
    getRoomFood(id),
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
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link
        href={`/app/rooms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {access.room.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{copy.food.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.food.subtitle}</p>
      </div>
      <FoodPanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialProposals={food.proposals}
        initialVotes={food.votes}
        initialComments={food.comments}
      />
    </div>
  );
}
