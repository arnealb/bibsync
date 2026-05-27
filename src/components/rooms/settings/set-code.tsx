"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { checkJoinCode, setJoinCode } from "@/app/_actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { isValidCustomCode, normalizeJoinCode } from "@/lib/rooms/join-code";
import { cn } from "@/lib/utils";

type CodeStatus = "idle" | "invalid" | "checking" | "available" | "taken";

export function SetCode({ roomId }: { roomId: string }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onChange(value: string) {
    setCode(value);
    const c = normalizeJoinCode(value);
    if (timer.current) clearTimeout(timer.current);
    if (c === "") {
      setStatus("idle");
      return;
    }
    if (!isValidCustomCode(c)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    timer.current = setTimeout(async () => {
      const { available } = await checkJoinCode(c);
      setStatus(available ? "available" : "taken");
    }, 400);
  }

  function save() {
    const c = normalizeJoinCode(code);
    if (!isValidCustomCode(c)) {
      setStatus("invalid");
      return;
    }
    start(async () => {
      const res = await setJoinCode(roomId, c);
      if (res.ok) {
        toast.success(copy.rooms.settings.codeSet);
        setCode("");
        setStatus("idle");
      } else {
        toast.error(res.error);
      }
    });
  }

  const statusText: Record<CodeStatus, string> = {
    idle: copy.rooms.settings.customCodeHint,
    invalid: copy.rooms.validation.codeChars,
    checking: copy.rooms.new.codeChecking,
    available: copy.rooms.new.codeAvailable,
    taken: copy.rooms.new.codeTaken,
  };

  const canSave =
    isValidCustomCode(normalizeJoinCode(code)) &&
    status !== "taken" &&
    !pending;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder={copy.rooms.settings.customCodePlaceholder}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          className="font-mono uppercase tracking-widest"
        />
        <Button onClick={save} disabled={!canSave}>
          {copy.rooms.settings.setCode}
        </Button>
      </div>
      <p
        className={cn(
          "text-xs",
          status === "available" && "text-emerald-600 dark:text-emerald-500",
          (status === "taken" || status === "invalid") && "text-destructive",
          (status === "idle" || status === "checking") &&
            "text-muted-foreground",
        )}
      >
        {statusText[status]}
      </p>
    </div>
  );
}
