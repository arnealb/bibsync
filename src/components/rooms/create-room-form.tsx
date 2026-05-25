"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { createRoom } from "@/app/_actions/rooms";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

export function CreateRoomForm() {
  const [state, formAction] = useActionState(createRoom, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="room-name">{copy.rooms.new.nameLabel}</Label>
        <Input
          id="room-name"
          name="name"
          maxLength={60}
          placeholder={copy.rooms.new.namePlaceholder}
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="room-description">
          {copy.rooms.new.descriptionLabel}
        </Label>
        <Textarea
          id="room-description"
          name="description"
          maxLength={280}
          rows={3}
          placeholder={copy.rooms.new.descriptionPlaceholder}
        />
      </div>
      {state && !state.ok && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      <SubmitButton pendingText={copy.rooms.new.submitting}>
        {copy.rooms.new.submit}
      </SubmitButton>
    </form>
  );
}
