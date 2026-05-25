import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateRoomForm } from "@/components/rooms/create-room-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.rooms.new.title };

export default function NewRoomPage() {
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
          <CardTitle>{copy.rooms.new.title}</CardTitle>
          <CardDescription>{copy.rooms.new.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateRoomForm />
        </CardContent>
      </Card>
    </div>
  );
}
