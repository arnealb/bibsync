"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUnreadChat } from "@/hooks/use-unread-chat";
import { formatUnreadBadge, markChatRead } from "@/lib/chat/unread";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface RoomTabsProps {
  roomId: string;
  userId: string;
}

interface TabDef {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
  badge?: number;
  onSelect?: () => void;
}

export function RoomTabs({ roomId, userId }: RoomTabsProps) {
  const pathname = usePathname();
  const base = `/app/rooms/${roomId}`;
  const chatHref = `${base}/chat`;
  const onChat = pathname === chatHref;
  const unread = useUnreadChat(roomId, userId, onChat);

  const tabs: TabDef[] = [
    {
      href: base,
      label: copy.rooms.tabs.overview,
      matches: (p) => p === base,
    },
    {
      href: chatHref,
      label: copy.rooms.tabs.chat,
      matches: (p) => p === chatHref,
      badge: unread,
      // Clear instantly on tap, before the chat page mounts and marks read.
      onSelect: () => markChatRead(roomId),
    },
    {
      href: `${base}/games`,
      label: copy.rooms.tabs.games,
      matches: (p) => p.startsWith(`${base}/games`),
    },
    {
      href: `${base}/markt`,
      label: copy.rooms.tabs.markt,
      matches: (p) => p.startsWith(`${base}/markt`),
    },
    {
      href: `${base}/stappen`,
      label: copy.rooms.tabs.steps,
      matches: (p) => p.startsWith(`${base}/stappen`),
    },
    {
      href: `${base}/schermtijd`,
      label: copy.rooms.tabs.screenTime,
      matches: (p) => p.startsWith(`${base}/schermtijd`),
    },
    {
      href: `${base}/voetbal`,
      label: copy.rooms.tabs.voetbal,
      matches: (p) => p.startsWith(`${base}/voetbal`),
    },
  ];

  return (
    <nav
      aria-label={copy.rooms.navLabel}
      className="mb-5 -mx-4 overflow-x-auto border-b px-4"
    >
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = tab.matches(pathname);
          const badge = tab.badge ?? 0;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={tab.onSelect}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {badge > 0 && (
                  <span
                    aria-label={copy.chat.unreadLabel(badge)}
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] leading-none font-semibold tabular-nums text-white"
                  >
                    {formatUnreadBadge(badge)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
