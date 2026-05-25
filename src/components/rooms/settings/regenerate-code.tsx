"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { regenerateJoinCode } from "@/app/_actions/rooms";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export function RegenerateCode({
  roomId,
  joinCode,
}: {
  roomId: string;
  joinCode: string;
}) {
  const [pending, startTransition] = useTransition();

  function onRegenerate() {
    startTransition(async () => {
      const result = await regenerateJoinCode(roomId);
      if (result.ok) toast.success(copy.rooms.settings.regenerated);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-lg tracking-widest">{joinCode}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerate}
        disabled={pending}
        className="gap-1.5"
      >
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
        {copy.rooms.settings.regenerate}
      </Button>
    </div>
  );
}
