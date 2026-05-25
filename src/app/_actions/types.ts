/**
 * Standard result for mutations (matches deel-2 spec: `{ok:true}` or an error).
 * Lives in a plain module so it can be imported by both client components and
 * `"use server"` action files.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };
