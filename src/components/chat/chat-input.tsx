"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { GifPicker } from "@/components/chat/gif-picker";
import { PhotoUpload } from "@/components/chat/photo-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toggleLeaderboardCheated } from "@/app/_actions/games";
import { clearPillory, setPillory } from "@/app/_actions/pillory";
import { claimRobbed, stealCoins } from "@/app/_actions/theft";
import { clearUserTimeout, setUserTimeout } from "@/app/_actions/timeouts";
import { setAutopilot } from "@/lib/games/snake/autopilot";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { applyRainbow } from "@/lib/rainbow";
import { cn } from "@/lib/utils";
import {
  MESSAGE_COUNTER_THRESHOLD,
  MESSAGE_MAX_LENGTH,
} from "@/lib/validation/messages";

/** Owner/admin member commands: /timeout, /untimeout, /schandpaal, /unschandpaal
 *  followed by a member name (schandpaal may add a reason after the name). */
const MANAGE_CMD = /^\/(timeout|untimeout|schandpaal|unschandpaal)\s+(.*)$/i;

/** Steal command (everyone): /steel <bedrag> <naam>. */
const STEAL_CMD = /^\/steel\s+(\d+)\s+(.*)$/i;

export function ChatInput({
  roomId,
  userId,
  members,
  canManage,
  onSend,
  onTyping,
  pending,
}: {
  roomId: string;
  userId: string;
  members: MemberMap;
  canManage: boolean;
  onSend: (content: string) => void;
  onTyping?: () => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const memberList = useMemo(
    () => Object.entries(members).map(([id, m]) => ({ id, name: m.name })),
    [members],
  );

  // Name-completion state. Manage commands need canManage; /steel is for all.
  const manageMatch = canManage ? value.match(MANAGE_CMD) : null;
  const stealMatch = value.match(STEAL_CMD);
  const nameMatch = manageMatch ?? stealMatch;
  const partial = nameMatch ? nameMatch[2].trim().toLowerCase() : "";
  // A full member name is present (optionally followed by a reason) → stop
  // suggesting so the user can type the rest.
  const nameLocked = memberList.some(
    (m) =>
      partial === m.name.toLowerCase() ||
      partial.startsWith(m.name.toLowerCase() + " "),
  );
  const suggestions =
    nameMatch && !nameLocked
      ? memberList
          .filter((m) => m.name.toLowerCase().includes(partial))
          .slice(0, 6)
      : [];
  const showSuggestions = suggestions.length > 0;
  const clampedIndex = Math.max(0, Math.min(activeIndex, suggestions.length - 1));

  function complete(name: string) {
    if (stealMatch) setValue(`/steel ${stealMatch[1]} ${name} `);
    else if (manageMatch) setValue(`/${manageMatch[1].toLowerCase()} ${name} `);
    setActiveIndex(0);
  }

  function runManageCommand(kind: string, rest: string) {
    const lower = rest.trim().toLowerCase();
    // Longest matching member name (so "Jan Peter" wins over "Jan").
    const member = memberList
      .filter(
        (m) =>
          lower === m.name.toLowerCase() ||
          lower.startsWith(m.name.toLowerCase() + " "),
      )
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (!member) {
      toast.error(copy.timeout.unknownUser);
      return;
    }
    const reason = rest.trim().slice(member.name.length).trim();
    setValue("");

    if (kind === "schandpaal" || kind === "unschandpaal") {
      const run =
        kind === "schandpaal"
          ? () => setPillory(roomId, member.id, reason || undefined)
          : () => clearPillory(roomId, member.id);
      void run().then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(
          kind === "schandpaal"
            ? copy.pillory.set(member.name)
            : copy.pillory.cleared(member.name),
        );
      });
      return;
    }

    const run = kind === "timeout" ? setUserTimeout : clearUserTimeout;
    void run(roomId, member.id).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        kind === "timeout"
          ? copy.timeout.set(member.name)
          : copy.timeout.cleared(member.name),
      );
    });
  }

  function runSteal(amount: number, rest: string) {
    const lower = rest.trim().toLowerCase();
    const member = memberList
      .filter(
        (m) =>
          lower === m.name.toLowerCase() ||
          lower.startsWith(m.name.toLowerCase() + " "),
      )
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (!member) {
      toast.error(copy.timeout.unknownUser);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(copy.theft.badAmount);
      return;
    }
    setValue("");
    void stealCoins({ roomId, victimId: member.id, amount }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(copy.theft.stole(amount, member.name));
    });
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const command = trimmed.toLowerCase();

    if (command === "/bestolen") {
      void claimRobbed().then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.kind === "reward") toast.success(copy.theft.claimed(res.amount));
        else if (res.kind === "late") toast(copy.theft.tooLate);
        else toast.error(copy.theft.falseClaim(res.amount));
      });
      setValue("");
      return;
    }

    const sm = trimmed.match(STEAL_CMD);
    if (sm) {
      runSteal(Number(sm[1]), sm[2]!);
      return;
    }

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
    if (command === "/cheatcodes" || command === "/cheatcodes-stop") {
      const on = command === "/cheatcodes";
      setAutopilot(on);
      toast.success(on ? copy.chat.snakeBotOn : copy.chat.snakeBotOff);
      setValue("");
      return;
    }
    if (command === "/honest") {
      void toggleLeaderboardCheated(roomId).then((result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.showCheated ? copy.chat.boardAllOn : copy.chat.boardHonestOn,
        );
      });
      setValue("");
      return;
    }

    const tm = canManage ? trimmed.match(MANAGE_CMD) : null;
    if (tm) {
      runManageCommand(tm[1].toLowerCase(), tm[2]);
      return;
    }

    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        complete(suggestions[clampedIndex]?.name ?? suggestions[0]!.name);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
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
      <PhotoUpload
        roomId={roomId}
        userId={userId}
        onUploaded={(url) => onSend(url)}
      />
      <div className="relative flex-1">
        {showSuggestions && (
          <ul className="absolute bottom-full mb-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    complete(m.name);
                  }}
                  className={cn(
                    "flex w-full items-center px-3 py-1.5 text-left text-sm",
                    i === clampedIndex ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActiveIndex(0);
            if (event.target.value.trim() && !event.target.value.startsWith("/")) {
              onTyping?.();
            }
          }}
          onKeyDown={onKeyDown}
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
