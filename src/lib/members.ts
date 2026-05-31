import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";

/** Shared shape for showing a member (name, avatar, equipped cosmetics). */
export interface MemberInfo {
  name: string;
  avatarUrl: string | null;
  loadout?: ResolvedLoadout | null;
}

/** Map of user id → member info, passed to room feature components. */
export type MemberMap = Record<string, MemberInfo>;

/** Minimal member row shape needed to build a {@link MemberMap}. */
interface MemberRow {
  user_id: string;
  profile: { display_name: string; avatar_url: string | null } | null;
  loadout?: ResolvedLoadout | null;
}

/** Build the id→info map from room members (incl. their cosmetics). */
export function toMemberMap(members: MemberRow[]): MemberMap {
  return Object.fromEntries(
    members.map((m) => [
      m.user_id,
      {
        name: m.profile?.display_name ?? "—",
        avatarUrl: m.profile?.avatar_url ?? null,
        loadout: m.loadout ?? null,
      },
    ]),
  );
}
