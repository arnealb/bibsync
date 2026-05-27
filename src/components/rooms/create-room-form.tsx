"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { checkJoinCode, createRoom } from "@/app/_actions/rooms";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { isValidCustomCode, normalizeJoinCode } from "@/lib/rooms/join-code";
import { cn } from "@/lib/utils";

type CodeStatus = "idle" | "invalid" | "checking" | "available" | "taken";

export function CreateRoomForm() {
  const [state, formAction] = useActionState(createRoom, null);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Debounced availability check, driven from the change handler (not an
  // effect) so we never set state synchronously during an effect.
  function onCodeChange(value: string) {
    const code = normalizeJoinCode(value);
    if (timer.current) clearTimeout(timer.current);
    if (code === "") {
      setStatus("idle");
      return;
    }
    if (!isValidCustomCode(code)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    timer.current = setTimeout(async () => {
      const { available } = await checkJoinCode(code);
      setStatus(available ? "available" : "taken");
    }, 400);
  }

  const statusText: Record<CodeStatus, string> = {
    idle: copy.rooms.new.codeHint,
    invalid: copy.rooms.new.codeHint,
    checking: copy.rooms.new.codeChecking,
    available: copy.rooms.new.codeAvailable,
    taken: copy.rooms.new.codeTaken,
  };

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
      <div className="space-y-1.5">
        <Label htmlFor="room-code">{copy.rooms.new.codeLabel}</Label>
        <Input
          id="room-code"
          name="joinCode"
          maxLength={12}
          placeholder={copy.rooms.new.codePlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          className="font-mono uppercase tracking-widest"
          onChange={(e) => onCodeChange(e.target.value)}
        />
        <p
          className={cn(
            "text-xs",
            status === "available" && "text-emerald-600 dark:text-emerald-500",
            status === "taken" && "text-destructive",
            status === "invalid" && "text-destructive",
            (status === "idle" || status === "checking") &&
              "text-muted-foreground",
          )}
        >
          {statusText[status]}
        </p>
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
