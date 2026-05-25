/**
 * Easter egg: typing `/alan` in the chat toggles "full rainbow mode" — a
 * `rainbow` class on <html> (styled in globals.css), persisted in localStorage.
 */
const KEY = "bibsync_rainbow";

export function isRainbow(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("rainbow")
  );
}

export function applyRainbow(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("rainbow", on);
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

export function toggleRainbow(): boolean {
  const next = !isRainbow();
  applyRainbow(next);
  return next;
}

export function initRainbow(): void {
  try {
    if (localStorage.getItem(KEY) === "1") applyRainbow(true);
  } catch {
    // ignore
  }
}
