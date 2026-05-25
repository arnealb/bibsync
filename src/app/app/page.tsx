import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LAST_ROOM_COOKIE } from "@/lib/rooms/constants";
import { getMyRooms } from "@/lib/rooms/queries";

/**
 * Entry point for the app: route to the last visited room when known,
 * otherwise to the rooms overview.
 */
export default async function AppIndexPage() {
  const rooms = await getMyRooms();
  if (rooms.length === 0) redirect("/app/rooms");

  const cookieStore = await cookies();
  const lastRoom = cookieStore.get(LAST_ROOM_COOKIE)?.value;
  if (lastRoom && rooms.some((room) => room.id === lastRoom)) {
    redirect(`/app/rooms/${lastRoom}`);
  }

  redirect("/app/rooms");
}
