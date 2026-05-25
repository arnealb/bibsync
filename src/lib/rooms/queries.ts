import { cache } from "react";

import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Room } from "@/types/database";

export interface RoomSummary extends Room {
  member_count: number;
}

export interface MemberWithProfile {
  user_id: string;
  joined_at: string;
  profile: Profile | null;
}

export interface RoomAccess {
  room: Room;
  userId: string;
  isOwner: boolean;
}

/** Rooms the current user owns or is a member of, with member counts. */
export const getMyRooms = cache(async (): Promise<RoomSummary[]> => {
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .order("created_at", { ascending: false });

  if (!rooms || rooms.length === 0) return [];

  const ids = rooms.map((room) => room.id);
  const { data: members } = await supabase
    .from("room_members")
    .select("room_id")
    .in("room_id", ids);

  const counts = new Map<string, number>();
  for (const member of members ?? []) {
    counts.set(member.room_id, (counts.get(member.room_id) ?? 0) + 1);
  }

  return rooms.map((room) => ({
    ...room,
    member_count: counts.get(room.id) ?? 0,
  }));
});

/** A single room, or null when it doesn't exist / isn't accessible (RLS). */
export const getRoom = cache(async (roomId: string): Promise<Room | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  return data;
});

/** Room access context for the current user, or null when no access. */
export const requireRoomAccess = cache(
  async (roomId: string): Promise<RoomAccess | null> => {
    const ctx = await getAuthContext();
    if (!ctx) return null;
    const room = await getRoom(roomId);
    if (!room) return null;
    return {
      room,
      userId: ctx.user.id,
      isOwner: room.owner_id === ctx.user.id,
    };
  },
);

/** Members of a room with their profiles, oldest first. */
export const getRoomMembers = cache(
  async (roomId: string): Promise<MemberWithProfile[]> => {
    const supabase = await createClient();
    const { data: members } = await supabase
      .from("room_members")
      .select("user_id, joined_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (!members || members.length === 0) return [];

    const ids = members.map((member) => member.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return members.map((member) => ({
      user_id: member.user_id,
      joined_at: member.joined_at,
      profile: byId.get(member.user_id) ?? null,
    }));
  },
);
