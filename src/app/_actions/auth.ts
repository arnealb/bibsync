"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AuthState } from "@/app/_actions/auth-types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";
import {
  loginSchema,
  magicLinkSchema,
  registerSchema,
} from "@/lib/validation/auth";

/** Only allow in-app relative redirect targets to avoid open redirects. */
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = typeof value === "string" ? value : "";
  return target.startsWith("/app") ? target : "/app";
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.auth.genericError,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: copy.auth.invalidCredentials };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectTarget(formData.get("redirectTo")));
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.auth.genericError,
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=/app`,
    },
  });
  if (error) {
    return { status: "error", message: copy.auth.genericError };
  }

  // When email confirmation is disabled, a session is returned immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/app");
  }

  return { status: "success", message: copy.auth.confirmEmailSent };
}

export async function magicLinkAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.auth.genericError,
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/app` },
  });
  if (error) {
    return { status: "error", message: copy.auth.genericError };
  }

  return { status: "success", message: copy.auth.magicLinkSent };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
