import { notFound, redirect } from "next/navigation";
import { Coins } from "lucide-react";

import { ClaimRobbed } from "@/components/bibcoins/claim-robbed";
import { GiftBibcoins } from "@/components/bibcoins/gift-bibcoins";
import { StealBibcoins } from "@/components/bibcoins/steal-bibcoins";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { getWallet } from "@/lib/bibcoins/queries";
import { getAuthContext } from "@/lib/auth";
import { COSMETIC_BY_ID, type CosmeticItem } from "@/lib/cosmetics/catalog";
import { effectClassName } from "@/lib/cosmetics/effects";
import { getLoadout, getOwnedCosmetics } from "@/lib/cosmetics/queries";
import { EMPTY_LOADOUT, resolveLoadout } from "@/lib/cosmetics/resolve";
import { copy } from "@/lib/copy";
import { getProfileStats } from "@/lib/profile/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

const RAINBOW =
  "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #38bdf8, #a855f7, #ec4899, #ef4444)";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-0.5 py-4">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function CosmeticChip({ item }: { item: CosmeticItem }) {
  const swatch =
    item.type === "frame" || item.type === "color" ? (
      <span
        className="size-3 shrink-0 rounded-full border"
        style={{
          background: item.value === "rainbow" ? RAINBOW : item.value,
        }}
      />
    ) : item.type === "effect" ? null : (
      <span className="leading-none">{item.value}</span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
      {swatch}
      <span className={effectClassName(item.type === "effect" ? item.value : "")}>
        {item.name}
      </span>
    </span>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const isSelf = id === ctx.user.id;
  const [stats, ownedIds, loadoutRow, myWallet] = await Promise.all([
    getProfileStats(id),
    getOwnedCosmetics(id),
    getLoadout(id),
    isSelf ? Promise.resolve({ bibcoins: 0, debt: 0 }) : getWallet(ctx.user.id),
  ]);

  const loadout = resolveLoadout(loadoutRow);
  const owned = ownedIds
    .map((itemId) => COSMETIC_BY_ID.get(itemId))
    .filter((item): item is CosmeticItem => Boolean(item));

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <UserAvatar
          name={profile.display_name}
          avatarUrl={profile.avatar_url}
          className="size-24"
          fallbackClassName="text-3xl"
          loadout={{ ...EMPTY_LOADOUT, frame: loadout.frame }}
        />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span
            className={`text-xl font-bold ${effectClassName(loadout.effect?.value)}`}
            style={
              loadout.color && !loadout.effect
                ? { color: loadout.color.value }
                : undefined
            }
          >
            {profile.display_name}
          </span>
          {loadout.title && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
              {loadout.title.value}
            </span>
          )}
        </div>
        {profile.created_at && (
          <p className="text-sm text-muted-foreground">
            {copy.profile.memberSince} {formatDateTime(profile.created_at)}
          </p>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums">
          <Coins className="size-4 text-amber-500" />
          {stats.bibcoins} {copy.profile.public.coins}
        </span>
        {!isSelf && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <GiftBibcoins
              recipientId={id}
              recipientName={profile.display_name}
              myBalance={myWallet.bibcoins}
            />
            <StealBibcoins
              victimId={id}
              victimName={profile.display_name}
              victimBalance={stats.bibcoins}
              viewerDebt={myWallet.debt}
            />
          </div>
        )}
        {isSelf && <ClaimRobbed />}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={copy.profile.public.proposals} value={stats.proposals} />
        <StatCard label={copy.profile.public.comments} value={stats.comments} />
        <StatCard label={copy.profile.public.messages} value={stats.messages} />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">{copy.profile.public.cosmeticsTitle}</h2>
        {owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {copy.profile.public.noCosmetics}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {owned.map((item) => (
              <CosmeticChip key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
