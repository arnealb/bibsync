"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { loginAction } from "@/app/_actions/auth";
import { initialAuthState } from "@/app/_actions/auth-types";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

export function PasswordLoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(loginAction, initialAuthState);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="space-y-2">
        <Label htmlFor="login-email">{copy.auth.emailLabel}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.auth.emailPlaceholder}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{copy.auth.passwordLabel}</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={copy.auth.passwordPlaceholder}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={copy.auth.submittingLogin}>
        {copy.auth.submitLogin}
      </SubmitButton>
    </form>
  );
}
