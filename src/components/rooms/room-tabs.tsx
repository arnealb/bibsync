"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface RoomTabsProps {
  roomId: string;
}

interface TabDef {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
}

export function RoomTabs({ roomId }: RoomTabsProps) {
  const pathname = usePathname();
  const base = `/app/rooms/${roomId}`;

  const tabs: TabDef[] = [
    {
      href: base,
      label: copy.rooms.tabs.overview,
      matches: (p) => p === base,
    },
    {
      href: `${base}/chat`,
      label: copy.rooms.tabs.chat,
      matches: (p) => p === `${base}/chat`,
    },
    {
      href: `${base}/eten`,
      label: copy.rooms.tabs.food,
      matches: (p) => p === `${base}/eten`,
    },
    {
      href: `${base}/games`,
      label: copy.rooms.tabs.games,
      matches: (p) => p.startsWith(`${base}/games`),
    },
    {
      href: `${base}/stappen`,
      label: copy.rooms.tabs.steps,
      matches: (p) => p.startsWith(`${base}/stappen`),
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
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
