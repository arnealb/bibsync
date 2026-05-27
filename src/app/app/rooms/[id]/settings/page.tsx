import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteRoom } from "@/components/rooms/settings/delete-room";
import { MemberList } from "@/components/rooms/settings/member-list";
import { RegenerateCode } from "@/components/rooms/settings/regenerate-code";
import { RenameRoomForm } from "@/components/rooms/settings/rename-room-form";
import { RoomLocationSettings } from "@/components/rooms/settings/room-location";
import { SetCode } from "@/components/rooms/settings/set-code";
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
  if (!access || !access.canManage) notFound();

  const members = await getRoomMembers(id);
  const memberItems = members.map((member) => ({
    userId: member.user_id,
    name: member.profile?.display_name ?? "—",
    avatarUrl: member.profile?.avatar_url ?? null,
    isOwner: member.user_id === access.room.owner_id,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold tracking-tight">
        {copy.rooms.settings.title}
      </h2>

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
        <CardContent className="space-y-4">
          <RegenerateCode roomId={id} joinCode={access.room.join_code} />
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">
              {copy.rooms.settings.customCode}
            </p>
            <SetCode roomId={id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.rooms.settings.location}</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomLocationSettings
            roomId={id}
            initialLat={access.room.lat}
            initialLng={access.room.lng}
            initialRadiusM={access.room.radius_m}
          />
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
