"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { deleteRoom } from "@/app/_actions/rooms";
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

export function DeleteRoom({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRoom(roomId);
      // success redirects; only an error returns here
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)} className="gap-1.5">
        <Trash2 className="size-4" />
        {copy.rooms.settings.deleteRoom}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.rooms.settings.deleteConfirmTitle}</DialogTitle>
          <DialogDescription>
            {copy.rooms.settings.deleteConfirmBody}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {copy.common.cancel}
          </DialogClose>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            {copy.rooms.settings.deleteRoom}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
