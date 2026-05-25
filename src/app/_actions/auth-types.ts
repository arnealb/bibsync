/**
 * Shared auth form state. Kept in a plain module (NOT a `"use server"` file)
 * because server-action files may only export async functions.
 */
export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialAuthState: AuthState = { status: "idle" };
