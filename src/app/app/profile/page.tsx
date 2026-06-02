import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { InstallAppCard } from "@/components/install-app-card";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { DisplayNameEdit } from "@/components/profile/display-name-edit";
import { NotificationSettings } from "@/components/profile/notification-settings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ACHIEVEMENTS } from "@/lib/bibcoins/achievements";
import { SCREEN_TIME_COINS_PER_MINUTE } from "@/lib/bibcoins/config";
import { getUnlockedAchievements } from "@/lib/bibcoins/queries";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { formatScreenTime } from "@/lib/screen-time/format";
import { getScreenTime } from "@/lib/screen-time/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, todayInBrussels } from "@/lib/time";

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
  const changedToday =
    ctx.profile?.display_name_changed_on === todayInBrussels();
  const unlocked = new Set(await getUnlockedAchievements(ctx.user.id));
  const screenTime = await getScreenTime(ctx.user.id);

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
            <DisplayNameEdit currentName={name} changedToday={changedToday} />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {copy.profile.screenTime.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={copy.profile.screenTime.today}
              value={formatScreenTime(screenTime.todaySeconds)}
            />
            <Field
              label={copy.profile.screenTime.total}
              value={formatScreenTime(screenTime.totalSeconds)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {copy.profile.screenTime.reward(SCREEN_TIME_COINS_PER_MINUTE)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {copy.bibcoins.achievements.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ACHIEVEMENTS.map((achievement) => {
              const done = unlocked.has(achievement.id);
              return (
                <li
                  key={achievement.id}
                  className={cn(
                    "flex items-center justify-between gap-2 text-sm",
                    !done && "opacity-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {done ? "🏆" : "🔒"} {achievement.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {done
                        ? achievement.description
                        : copy.bibcoins.achievements.locked}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-amber-500 tabular-nums">
                    {copy.bibcoins.achievements.reward(achievement.reward)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <NotificationSettings
        prefs={{
          proposals: ctx.profile?.notify_proposals ?? true,
          chat: ctx.profile?.notify_chat ?? true,
          comments: ctx.profile?.notify_comments ?? true,
          votes: ctx.profile?.notify_votes ?? true,
          market: ctx.profile?.notify_market ?? true,
        }}
      />
      <InstallAppCard />
      <LogoutButton />
    </div>
  );
}
