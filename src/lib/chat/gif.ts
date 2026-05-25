/**
 * Whether a message body is a single image/GIF URL the chat should render
 * inline (e.g. a Giphy link sent via the GIF picker, or a pasted image URL).
 */
export function isGifUrl(content: string): boolean {
  const value = content.trim();
  if (/\s/.test(value)) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return (
    /\.(gif|webp|png|jpe?g)(\?|$)/i.test(value) ||
    /(giphy\.com|tenor\.com)/i.test(value)
  );
}
