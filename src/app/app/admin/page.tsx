import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { getMyRooms } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: copy.admin.title };

export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx?.isAdmin) notFound();

  // Admins can read every room (RLS admin policy).
  const rooms = await getMyRooms();

  const ownerIds = [...new Set(rooms.map((room) => room.owner_id))];
  const supabase = await createClient();
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds)
    : { data: [] };
  const ownerName = new Map(
    (owners ?? []).map((owner) => [owner.id, owner.display_name]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {copy.admin.title}
        </h1>
        <Badge variant="secondary">{copy.admin.badge}</Badge>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        {copy.admin.subtitle}
      </p>

      {rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {copy.admin.empty}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/app/rooms/${room.id}`}
                  className="font-medium hover:underline"
                >
                  {room.name}
                </Link>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {copy.admin.owner}: {ownerName.get(room.owner_id) ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {room.member_count}
                  </span>
                </p>
              </div>
              <Button
                render={<Link href={`/app/rooms/${room.id}/settings`} />}
                nativeButton={false}
                variant="outline"
                size="sm"
              >
                <Settings className="size-4" />
                {copy.admin.manage}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
