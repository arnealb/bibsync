"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/lib/copy";

interface RoomOption {
  id: string;
  name: string;
}

/** Header dropdown to switch between rooms; highlights the current one. */
export function RoomSwitcher({ rooms }: { rooms: RoomOption[] }) {
  const pathname = usePathname();
  const currentId = pathname.match(/^\/app\/rooms\/([0-9a-fA-F-]+)/)?.[1];
  const current = rooms.find((room) => room.id === currentId);
  const label = current?.name ?? copy.rooms.listTitle;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="max-w-[45vw] gap-1.5" />}
      >
        <span className="truncate font-medium">{label}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {rooms.map((room) => (
          <DropdownMenuItem
            key={room.id}
            render={<Link href={`/app/rooms/${room.id}`} />}
          >
            <span className="truncate">{room.name}</span>
            {room.id === currentId && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        {rooms.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem render={<Link href="/app/rooms" />}>
          <LayoutGrid className="size-4" />
          {copy.rooms.switcherAll}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
