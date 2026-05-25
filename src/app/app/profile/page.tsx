import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: copy.profile.title };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const name = ctx.profile?.display_name ?? "—";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{copy.profile.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload
            userId={ctx.user.id}
            name={name}
            avatarUrl={ctx.profile?.avatar_url ?? null}
          />
          <div className="space-y-4">
            <Field label={copy.profile.displayNameLabel} value={name} />
            <Field label={copy.profile.emailLabel} value={ctx.user.email ?? "—"} />
            {ctx.profile?.created_at && (
              <Field
                label={copy.profile.memberSince}
                value={formatDateTime(ctx.profile.created_at)}
              />
            )}
          </div>
        </CardContent>
      </Card>
      <LogoutButton />
    </div>
  );
}
