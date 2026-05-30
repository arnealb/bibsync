"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { updateDisplayName } from "@/app/_actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { DISPLAY_NAME_CHANGE_COST } from "@/lib/validation/profile";

export function DisplayNameEdit({
  currentName,
  changedToday,
}: {
  currentName: string;
  changedToday: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const disabled = pending || changedToday || !trimmed || trimmed === currentName;

  function onSave() {
    if (disabled) return;
    startTransition(async () => {
      const result = await updateDisplayName(trimmed);
      if (result.ok) {
        toast.success(copy.profile.nameEdit.updated);
        router.refresh();
      } else {
        toast.error(result.error);
        setName(currentName);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {copy.profile.displayNameLabel}
      </p>
      <div className="flex gap-2">
        <Input
          value={name}
          maxLength={40}
          disabled={pending || changedToday}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
          }}
        />
        <Button variant="outline" disabled={disabled} onClick={onSave}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Pencil className="size-4" />
          )}
          {copy.profile.nameEdit.save}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {changedToday
          ? copy.profile.nameEdit.alreadyToday
          : copy.profile.nameEdit.cost(DISPLAY_NAME_CHANGE_COST)}
      </p>
    </div>
  );
}
