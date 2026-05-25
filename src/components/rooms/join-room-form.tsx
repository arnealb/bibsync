"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { joinRoom } from "@/app/_actions/rooms";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { JOIN_CODE_LENGTH } from "@/lib/rooms/join-code";

export function JoinRoomForm() {
  const [state, formAction] = useActionState(joinRoom, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="join-code">{copy.rooms.join.codeLabel}</Label>
        <Input
          id="join-code"
          name="joinCode"
          maxLength={JOIN_CODE_LENGTH}
          placeholder={copy.rooms.join.codePlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="text-center text-lg font-medium tracking-[0.4em] uppercase"
          required
          autoFocus
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
      <SubmitButton pendingText={copy.rooms.join.submitting}>
        {copy.rooms.join.submit}
      </SubmitButton>
    </form>
  );
}
