import { headers } from "next/headers";

/**
 * Builds the request origin (e.g. `https://bibsync.vercel.app`) from the
 * incoming request headers. Used for email redirect URLs in auth flows so it
 * works on localhost and in production without hardcoding.
 */
export async function getOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
