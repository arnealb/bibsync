"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { initialAuthState, magicLinkAction } from "@/app/_actions/auth";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

export function MagicLinkForm() {
  const [state, formAction] = useActionState(
    magicLinkAction,
    initialAuthState,
  );

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">{copy.auth.magicLinkHint}</p>
      <div className="space-y-2">
        <Label htmlFor="magic-email">{copy.auth.emailLabel}</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.auth.emailPlaceholder}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={copy.auth.submittingMagicLink}>
        {copy.auth.submitMagicLink}
      </SubmitButton>
    </form>
  );
}
