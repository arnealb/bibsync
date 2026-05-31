"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Gift } from "lucide-react";

import { sendBibcoins } from "@/app/_actions/bibcoins";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

/** "Stuur bibcoins" button + dialog on another user's profile. */
export function GiftBibcoins({
  recipientId,
  recipientName,
  myBalance,
}: {
  recipientId: string;
  recipientName: string;
  myBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [pending, start] = useTransition();

  function onSend() {
    if (amount < 1 || amount > myBalance) {
      toast.error(copy.bibcoins.transfer.failed);
      return;
    }
    start(async () => {
      const result = await sendBibcoins({ recipientId, amount });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(copy.bibcoins.transfer.success(amount, recipientName));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Gift className="size-4" />
            {copy.bibcoins.transfer.button}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.bibcoins.transfer.title(recipientName)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="gift-amount">{copy.bibcoins.transfer.amountLabel}</Label>
          <Input
            id="gift-amount"
            type="number"
            min={1}
            max={myBalance}
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-amber-500" />
            {copy.bibcoins.balance(myBalance)}
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {copy.common.cancel}
          </DialogClose>
          <Button
            onClick={onSend}
            disabled={pending || amount < 1 || amount > myBalance}
          >
            {pending ? copy.bibcoins.transfer.sending : copy.bibcoins.transfer.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
