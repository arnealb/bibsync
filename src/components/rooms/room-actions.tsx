"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, LogOut, Settings } from "lucide-react";

import { leaveRoom } from "@/app/_actions/rooms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

interface RoomActionsProps {
  roomId: string;
  joinCode: string;
  isOwner: boolean;
}

export function RoomActions({ roomId, joinCode, isOwner }: RoomActionsProps) {
  const [copied, setCopied] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      toast.success(copy.rooms.codeCopied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(copy.common.genericError);
    }
  }

  function onLeave() {
    startTransition(async () => {
      const result = await leaveRoom(roomId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={copyCode}
        className="gap-1.5 font-mono tracking-widest"
        aria-label={copy.rooms.copyCode}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {joinCode}
      </Button>

      {isOwner ? (
        <Button
          variant="ghost"
          size="icon"
          render={<Link href={`/app/rooms/${roomId}/settings`} />}
          nativeButton={false}
          aria-label={copy.rooms.settings.title}
        >
          <Settings />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.rooms.leave}
            onClick={() => setLeaveOpen(true)}
          >
            <LogOut />
          </Button>
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{copy.rooms.leaveConfirmTitle}</DialogTitle>
                <DialogDescription>
                  {copy.rooms.leaveConfirmBody}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {copy.common.cancel}
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={onLeave}
                  disabled={pending}
                >
                  {copy.common.confirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
