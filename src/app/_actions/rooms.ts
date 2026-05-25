"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { generateJoinCode } from "@/lib/rooms/join-code";
import { createClient } from "@/lib/supabase/server";
import {
  createRoomSchema,
  joinRoomSchema,
  renameRoomSchema,
} from "@/lib/validation/rooms";

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 5;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createRoomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: copy.common.notAuthenticated };

  let roomId: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        join_code: generateJoinCode(),
        owner_id: userId,
      })
      .select("id")
      .single();
    if (!error && data) {
      roomId = data.id;
      break;
    }
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("[createRoom]", error);
      return { ok: false, error: copy.common.genericError };
    }
  }
  if (!roomId) return { ok: false, error: copy.common.genericError };

  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: roomId, user_id: userId });
  if (memberError) console.error("[createRoom:member]", memberError);

  revalidatePath("/app/rooms");
  redirect(`/app/rooms/${roomId}`);
}

export async function joinRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = joinRoomSchema.safeParse({ joinCode: formData.get("joinCode") });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", {
    _code: parsed.data.joinCode,
  });
  if (error) {
    console.error("[joinRoom]", error);
    return { ok: false, error: copy.common.genericError };
  }
  if (!data) return { ok: false, error: copy.rooms.join.notFound };

  revalidatePath("/app/rooms");
  redirect(`/app/rooms/${data}`);
}

export async function leaveRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: copy.common.notAuthenticated };

  const { data: room } = await supabase
    .from("rooms")
    .select("owner_id")
    .eq("id", roomId)
    .maybeSingle();
  if (room?.owner_id === userId) {
    return { ok: false, error: copy.rooms.ownerCannotLeave };
  }

  const { error } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) {
    console.error("[leaveRoom]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath("/app/rooms");
  redirect("/app/rooms");
}

export async function kickMember(
  roomId: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const me = await currentUserId();
  if (!me) return { ok: false, error: copy.common.notAuthenticated };
  if (userId === me) return { ok: false, error: copy.common.genericError };

  const { error } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) {
    console.error("[kickMember]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath(`/app/rooms/${roomId}/settings`);
  return { ok: true };
}

export async function regenerateJoinCode(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const { error } = await supabase
      .from("rooms")
      .update({ join_code: generateJoinCode() })
      .eq("id", roomId);
    if (!error) {
      revalidatePath(`/app/rooms/${roomId}/settings`);
      return { ok: true };
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[regenerateJoinCode]", error);
      return { ok: false, error: copy.common.genericError };
    }
  }
  return { ok: false, error: copy.common.genericError };
}

export async function renameRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = renameRoomSchema.safeParse({
    roomId: formData.get("roomId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", parsed.data.roomId);
  if (error) {
    console.error("[renameRoom]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath(`/app/rooms/${parsed.data.roomId}/settings`);
  revalidatePath(`/app/rooms/${parsed.data.roomId}`);
  return { ok: true };
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) {
    console.error("[deleteRoom]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath("/app/rooms");
  redirect("/app/rooms");
}
