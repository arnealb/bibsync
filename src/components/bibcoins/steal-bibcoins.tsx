"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Grab } from "lucide-react";

import { stealCoins } from "@/app/_actions/theft";
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

/** "Stelen" button + dialog on another user's profile. */
export function StealBibcoins({
  victimId,
  victimName,
  victimBalance,
  viewerDebt = 0,
}: {
  victimId: string;
  victimName: string;
  victimBalance: number;
  viewerDebt?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => Math.min(100, victimBalance));
  const [pending, start] = useTransition();

  const tooMuch = amount < 1 || amount > victimBalance;

  function onSteal() {
    if (tooMuch) {
      toast.error(copy.theft.badAmount);
      return;
    }
    start(async () => {
      const result = await stealCoins({ victimId, amount });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(copy.theft.stole(amount, victimName));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
            disabled={victimBalance < 1 || viewerDebt > 0}
            title={viewerDebt > 0 ? copy.theft.debtBlocked : undefined}
          >
            <Grab className="size-4" />
            {copy.theft.button}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.theft.dialogTitle(victimName)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="steal-amount">{copy.theft.amountLabel}</Label>
          <Input
            id="steal-amount"
            type="number"
            min={1}
            max={victimBalance}
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-amber-500" />
            {copy.theft.victimHas(victimBalance)}
          </p>
          <p className="text-xs text-muted-foreground">{copy.theft.warning}</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {copy.common.cancel}
          </DialogClose>
          <Button onClick={onSteal} disabled={pending || tooMuch}>
            {pending ? copy.theft.stealing : copy.theft.steal}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
