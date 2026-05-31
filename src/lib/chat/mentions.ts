/** @mention parsing — shared by the send action (push) and the renderer. */

/** A run of message text, flagged if it's a highlighted @mention. */
export interface MentionPart {
  text: string;
  mention: boolean;
}

const MENTION_RE = /@[\p{L}\p{N}_]+/gu;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * User ids mentioned in `content`. Matches `@<display name>` (case-insensitive,
 * not as a prefix of a longer word), so names with spaces work too.
 */
export function mentionedUserIds(
  content: string,
  members: { id: string; name: string }[],
): string[] {
  const ids: string[] = [];
  for (const member of members) {
    const name = member.name?.trim();
    if (!name) continue;
    const re = new RegExp(`@${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "iu");
    if (re.test(content)) ids.push(member.id);
  }
  return ids;
}

/**
 * Split `content` into parts, flagging `@token`s that match a known member name
 * (lower-cased) so the UI can highlight them. Single-word names only for the
 * visual pass — multi-word mentions still notify, they just aren't highlighted.
 */
export function splitMentions(
  content: string,
  names: Set<string>,
): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of content.matchAll(MENTION_RE)) {
    const idx = match.index ?? 0;
    const token = match[0];
    if (idx > last) parts.push({ text: content.slice(last, idx), mention: false });
    parts.push({ text: token, mention: names.has(token.slice(1).toLowerCase()) });
    last = idx + token.length;
  }
  if (last < content.length) {
    parts.push({ text: content.slice(last), mention: false });
  }
  return parts;
}
