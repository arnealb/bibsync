"use client";

import { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { COMMENT_MAX_LENGTH } from "@/lib/validation/comments";

/** Minimal comment shape — works for both proposal and food comments. */
export interface CommentLike {
  id: string;
  author_id: string;
  content: string;
}

interface ProposalCommentsProps {
  proposalId: string;
  comments: CommentLike[];
  members: MemberMap;
  userId: string;
  /** When false, the add-comment form is hidden (e.g. not present). */
  canComment?: boolean;
  onAdd: (proposalId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

export function ProposalComments({
  proposalId,
  comments,
  members,
  userId,
  canComment = true,
  onAdd,
  onDelete,
}: ProposalCommentsProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(proposalId, trimmed);
    setValue("");
  }

  return (
    <div className="mt-3 border-t pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MessageSquare className="size-4" />
        {copy.proposals.comments.toggle(comments.length)}
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {copy.proposals.comments.empty}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="group flex items-start gap-2 text-sm"
                >
                  <UserAvatar
                    name={members[comment.author_id]?.name ?? "—"}
                    avatarUrl={members[comment.author_id]?.avatarUrl}
                    className="mt-0.5 size-5"
                    fallbackClassName="text-[9px]"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">
                      {members[comment.author_id]?.name ?? "—"}
                    </span>{" "}
                    <span className="break-words">{comment.content}</span>
                  </div>
                  {comment.author_id === userId && (
                    <button
                      type="button"
                      onClick={() => onDelete(comment.id)}
                      aria-label={copy.common.delete}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canComment && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder={copy.proposals.comments.placeholder}
                className="h-8"
              />
              <Button
                type="submit"
                size="icon-sm"
                aria-label={copy.proposals.comments.send}
                disabled={value.trim().length === 0}
              >
                <Send />
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
