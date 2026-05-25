import type { Metadata } from "next";
import Link from "next/link";
import { DoorOpen, LogIn, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { getMyRooms } from "@/lib/rooms/queries";

export const metadata: Metadata = { title: copy.rooms.listTitle };

export default async function RoomsPage() {
  const rooms = await getMyRooms();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {copy.rooms.listTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.rooms.listSubtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            render={<Link href="/app/rooms/join" />}
            nativeButton={false}
            variant="outline"
          >
            <LogIn />
            {copy.rooms.joinRoom}
          </Button>
          <Button render={<Link href="/app/rooms/new" />} nativeButton={false}>
            <Plus />
            {copy.rooms.newRoom}
          </Button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <DoorOpen className="size-8 text-muted-foreground" />
          <p className="max-w-xs text-sm text-muted-foreground">
            {copy.rooms.empty}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/app/rooms/${room.id}`}
                className="block h-full rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <span className="font-medium">{room.name}</span>
                {room.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {room.description}
                  </p>
                )}
                <span className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {copy.rooms.membersCount(room.member_count)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
