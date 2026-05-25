"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { GifPicker } from "@/components/chat/gif-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { applyRainbow } from "@/lib/rainbow";
import {
  MESSAGE_COUNTER_THRESHOLD,
  MESSAGE_MAX_LENGTH,
} from "@/lib/validation/messages";

export function ChatInput({
  onSend,
  pending,
}: {
  onSend: (content: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Easter eggs: /alan → full rainbow mode, /boobs → back to normal.
    const command = trimmed.toLowerCase();
    if (command === "/alan") {
      applyRainbow(true);
      toast.success(copy.chat.rainbowOn);
      setValue("");
      return;
    }
    if (command === "/boobs") {
      applyRainbow(false);
      toast.success(copy.chat.rainbowOff);
      setValue("");
      return;
    }
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t bg-background p-2"
    >
      <GifPicker onSelect={(url) => onSend(url)} />
      <div className="relative flex-1">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={copy.chat.placeholder}
          className="max-h-32 min-h-9 resize-none"
        />
        {value.length > MESSAGE_COUNTER_THRESHOLD && (
          <span className="absolute -top-5 right-0 text-xs text-muted-foreground tabular-nums">
            {value.length}/{MESSAGE_MAX_LENGTH}
          </span>
        )}
      </div>
      <Button
        type="submit"
        size="icon"
        aria-label={copy.chat.send}
        disabled={pending || value.trim().length === 0}
      >
        <Send />
      </Button>
    </form>
  );
}
