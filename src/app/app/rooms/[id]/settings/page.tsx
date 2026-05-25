import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DeleteRoom } from "@/components/rooms/settings/delete-room";
import { MemberList } from "@/components/rooms/settings/member-list";
import { RegenerateCode } from "@/components/rooms/settings/regenerate-code";
import { RenameRoomForm } from "@/components/rooms/settings/rename-room-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SettingsPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return { title: `${copy.rooms.settings.title} · ${access?.room.name ?? ""}` };
}

export default async function RoomSettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access || !access.isOwner) notFound();

  const members = await getRoomMembers(id);
  const memberItems = members.map((member) => ({
    userId: member.user_id,
    name: member.profile?.display_name ?? "—",
    isOwner: member.user_id === access.room.owner_id,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link
        href={`/app/rooms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {access.room.name}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        {copy.rooms.settings.title}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{copy.rooms.settings.rename}</CardTitle>
        </CardHeader>
        <CardContent>
          <RenameRoomForm
            roomId={id}
            name={access.room.name}
            description={access.room.description}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.rooms.settings.regenerate}</CardTitle>
          <CardDescription>
            {copy.rooms.settings.regenerateHint}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegenerateCode roomId={id} joinCode={access.room.join_code} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {copy.rooms.settings.members} · {memberItems.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MemberList roomId={id} members={memberItems} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">
            {copy.rooms.settings.dangerZone}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteRoom roomId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
