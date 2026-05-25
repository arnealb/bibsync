"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { renameRoom } from "@/app/_actions/rooms";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

interface RenameRoomFormProps {
  roomId: string;
  name: string;
  description: string | null;
}

export function RenameRoomForm({
  roomId,
  name,
  description,
}: RenameRoomFormProps) {
  const [state, formAction] = useActionState(renameRoom, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(copy.rooms.settings.renamed);
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="roomId" value={roomId} />
      <div className="space-y-2">
        <Label htmlFor="settings-name">{copy.rooms.new.nameLabel}</Label>
        <Input
          id="settings-name"
          name="name"
          defaultValue={name}
          maxLength={60}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-description">
          {copy.rooms.new.descriptionLabel}
        </Label>
        <Textarea
          id="settings-description"
          name="description"
          defaultValue={description ?? ""}
          maxLength={280}
          rows={3}
        />
      </div>
      <SubmitButton pendingText={copy.common.saving}>
        {copy.common.save}
      </SubmitButton>
    </form>
  );
}
