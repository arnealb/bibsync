"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { claimRobbed } from "@/app/_actions/theft";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/**
 * Always-available "ik ben bestolen" claim on your own profile. Pays out if you
 * really were robbed (and haven't spent since); costs the penalty if not.
 */
export function ClaimRobbed() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function claim() {
    start(async () => {
      const res = await claimRobbed();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.kind === "reward") toast.success(copy.theft.claimed(res.amount));
      else if (res.kind === "late") toast(copy.theft.tooLate);
      else toast.error(copy.theft.falseClaim(res.amount));
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={claim}
    >
      <ShieldAlert className="size-4" />
      {copy.theft.claimButton}
    </Button>
  );
}
