import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat/chat-panel";
import { getRoomReactions } from "@/lib/chat/reactions-queries";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { getRoomMessages } from "@/lib/messages/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ChatPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.chat.title} · ${access.room.name}` : copy.chat.title,
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [members, messagesData, reactions] = await Promise.all([
    getRoomMembers(id),
    getRoomMessages(id),
    getRoomReactions(id),
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.chat.title}
        </h2>
      </div>
      <ChatPanel
        roomId={access.room.id}
        userId={access.userId}
        members={memberMap}
        canManage={access.canManage}
        initialMessages={messagesData.messages}
        initialHasMore={messagesData.hasMore}
        initialReactions={reactions}
      />
    </div>
  );
}
