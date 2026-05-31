"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Moon } from "lucide-react";

import { checkStrijder, claimStrijder } from "@/app/_actions/bibcoins";
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

/**
 * Popup on the room overview offering the "Strijder" night bonus when it's
 * claimable (00:30–01:30 Brussels, not yet claimed). Server-checked; re-checks
 * each minute during the local night hours so it appears even if you were
 * already on the page when the window opened.
 */
export function StrijderPopup({ initialClaimable }: { initialClaimable: boolean }) {
  const [open, setOpen] = useState(initialClaimable);
  const [pending, setPending] = useState(false);
  const claimed = useRef(false);

  useEffect(() => {
    function tick() {
      if (claimed.current) return;
      const h = new Date().getHours();
      if (h !== 0 && h !== 1) return; // only ping during the local night window
      void checkStrijder().then((claimable) => {
        if (claimable && !claimed.current) setOpen(true);
      });
    }
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  function claim() {
    setPending(true);
    void claimStrijder().then((result) => {
      setPending(false);
      claimed.current = true;
      setOpen(false);
      if (result.ok && result.granted > 0) {
        toast.success(copy.bibcoins.strijderGranted(result.granted));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="size-5 text-indigo-400" />
            {copy.bibcoins.strijder.title}
          </DialogTitle>
          <DialogDescription>{copy.bibcoins.strijder.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {copy.bibcoins.strijder.later}
          </DialogClose>
          <Button onClick={claim} disabled={pending}>
            {copy.bibcoins.strijder.claim}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
