/**
 * Snake autopilot flag, toggled from the chat via `/snake`. Persisted in
 * localStorage so it survives the navigation from the chat to the game page.
 */
const KEY = "bibsync_snake_bot";
export const SNAKE_BOT_EVENT = "bibsync:snakebot";

export function isAutopilot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutopilot(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // ignore storage errors (private mode etc.)
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SNAKE_BOT_EVENT, { detail: on }));
  }
}
