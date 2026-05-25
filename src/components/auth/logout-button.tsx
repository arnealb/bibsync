"use client";

import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/_actions/auth";
import { SubmitButton } from "@/components/auth/submit-button";
import { copy } from "@/lib/copy";

/** Logout form — posts to the server action so the session cookie is cleared. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton pendingText={copy.nav.logout}>
        <LogOut className="size-4" />
        {copy.nav.logout}
      </SubmitButton>
    </form>
  );
}
