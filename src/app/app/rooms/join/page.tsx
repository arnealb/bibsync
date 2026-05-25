import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { JoinRoomForm } from "@/components/rooms/join-room-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.rooms.join.title };

export default function JoinRoomPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Link
        href="/app/rooms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {copy.rooms.listTitle}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{copy.rooms.join.title}</CardTitle>
          <CardDescription>{copy.rooms.join.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinRoomForm />
        </CardContent>
      </Card>
    </div>
  );
}
