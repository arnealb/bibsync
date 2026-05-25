import type { Message } from "@/types/database";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface ChatMessage extends Message {
  /** Optimistic local message not yet confirmed by the server. */
  pending?: boolean;
}

export interface MessageGroup {
  key: string;
  authorId: string;
  startedAt: string;
  items: ChatMessage[];
}

/**
 * Groups consecutive messages from the same author within 5 minutes so the
 * UI can render one header per group.
 */
export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const last = groups[groups.length - 1];
    const withinWindow =
      last &&
      last.authorId === message.author_id &&
      new Date(message.created_at).getTime() -
        new Date(last.items[last.items.length - 1].created_at).getTime() <
        GROUP_WINDOW_MS;

    if (withinWindow) {
      last.items.push(message);
    } else {
      groups.push({
        key: message.id,
        authorId: message.author_id,
        startedAt: message.created_at,
        items: [message],
      });
    }
  }

  return groups;
}
