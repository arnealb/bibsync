"use client";

import { useState, useTransition } from "react";
import { Siren } from "lucide-react";
import { toast } from "sonner";

import { claimRobbed } from "@/app/_actions/theft";
import { Button } from "@/components/ui/button";
import { useTheftRealtime } from "@/hooks/use-theft-realtime";
import { copy } from "@/lib/copy";
import type { PendingTheft } from "@/lib/theft/queries";

/** Red banner shown to a victim with open thefts, with the claim button. */
export function TheftBanner({
  userId,
  initialThefts,
}: {
  userId: string;
  initialThefts: PendingTheft[];
}) {
  const [thefts, setThefts] = useState<PendingTheft[]>(initialThefts);
  const [pending, start] = useTransition();

  useTheftRealtime(userId, {
    onRobbed: (theft) =>
      setThefts((prev) =>
        prev.some((t) => t.id === theft.id) ? prev : [theft, ...prev],
      ),
    onResolved: (id) => setThefts((prev) => prev.filter((t) => t.id !== id)),
  });

  if (thefts.length === 0) return null;

  const total = thefts.reduce((sum, t) => sum + t.amount, 0);

  function claim() {
    start(async () => {
      const res = await claimRobbed();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.kind === "reward") {
        toast.success(copy.theft.claimed(res.amount));
        setThefts([]);
      } else if (res.kind === "late") {
        toast(copy.theft.tooLate);
        setThefts([]);
      } else {
        toast.error(copy.theft.falseClaim(res.amount));
        setThefts([]);
      }
    });
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-gradient-to-b from-red-950/60 to-background px-4 py-3 shadow-sm ring-1 ring-red-500/10"
    >
      <Siren className="size-5 shrink-0 text-red-500" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-red-200">{copy.theft.bannerTitle}</p>
        <p className="text-sm text-muted-foreground">
          {copy.theft.bannerBody(total)}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={claim}
      >
        {copy.theft.claimButton}
      </Button>
    </div>
  );
}
