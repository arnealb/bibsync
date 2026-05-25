"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { registerAction } from "@/app/_actions/auth";
import { initialAuthState } from "@/app/_actions/auth-types";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialAuthState);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">{copy.auth.displayNameLabel}</Label>
        <Input
          id="register-name"
          name="displayName"
          type="text"
          autoComplete="nickname"
          placeholder={copy.auth.displayNamePlaceholder}
          maxLength={40}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">{copy.auth.emailLabel}</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.auth.emailPlaceholder}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">{copy.auth.passwordLabel}</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={copy.auth.passwordPlaceholder}
          minLength={8}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={copy.auth.submittingRegister}>
        {copy.auth.submitRegister}
      </SubmitButton>
    </form>
  );
}
