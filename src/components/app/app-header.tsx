import Link from "next/link";
import { Shield } from "lucide-react";

import { RoomSwitcher } from "@/components/app/room-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { getMyRooms } from "@/lib/rooms/queries";

export async function AppHeader() {
  const [ctx, rooms] = await Promise.all([getAuthContext(), getMyRooms()]);
  const name = ctx?.profile?.display_name ?? ctx?.user.email ?? "?";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Link href="/app" className="shrink-0 font-semibold tracking-tight">
            {copy.app.name}
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <RoomSwitcher
            rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {ctx?.isAdmin && (
            <Button
              render={<Link href="/app/admin" />}
              nativeButton={false}
              variant="ghost"
              size="icon"
              aria-label={copy.nav.admin}
            >
              <Shield />
            </Button>
          )}
          <ThemeToggle />
          <Link
            href="/app/profile"
            aria-label={copy.nav.profile}
            className="rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <UserAvatar
              name={name}
              avatarUrl={ctx?.profile?.avatar_url ?? null}
              className="size-9"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
