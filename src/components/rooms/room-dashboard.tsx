"use client";

import { MessageCircle } from "lucide-react";

import { LastRoomTracker } from "@/components/rooms/last-room-tracker";
import { RoomActions } from "@/components/rooms/room-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy } from "@/lib/copy";

interface RoomDashboardProps {
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  joinCode: string;
  isOwner: boolean;
  memberCount: number;
  statusSlot: React.ReactNode;
  breaksSlot: React.ReactNode;
  presenceSlot: React.ReactNode;
  chatSlot: React.ReactNode;
}

function ChatPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <MessageCircle className="size-5" />
      {copy.rooms.chatPlaceholder}
    </div>
  );
}

export function RoomDashboard({
  roomId,
  roomName,
  roomDescription,
  joinCode,
  isOwner,
  memberCount,
  statusSlot,
  breaksSlot,
  presenceSlot,
  chatSlot,
}: RoomDashboardProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LastRoomTracker roomId={roomId} />

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

      {statusSlot && <div className="mb-4">{statusSlot}</div>}

      {/* Mobile: tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="breaks">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="breaks">{copy.rooms.tabs.breaks}</TabsTrigger>
            <TabsTrigger value="presence">
              {copy.rooms.tabs.presence}
            </TabsTrigger>
            <TabsTrigger value="chat">{copy.rooms.tabs.chat}</TabsTrigger>
          </TabsList>
          <TabsContent value="breaks" className="pt-4">
            {breaksSlot}
          </TabsContent>
          <TabsContent value="presence" className="pt-4">
            {presenceSlot}
          </TabsContent>
          <TabsContent value="chat" className="pt-4">
            {chatSlot ?? <ChatPlaceholder />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: split view */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[1fr_320px]">
        <section className="min-w-0">{breaksSlot}</section>
        <aside className="space-y-4">
          {presenceSlot}
          {chatSlot ?? <ChatPlaceholder />}
        </aside>
      </div>
    </div>
  );
}
