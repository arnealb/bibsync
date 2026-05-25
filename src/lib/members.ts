/** Shared shape for showing a member (name + optional avatar) in the UI. */
export interface MemberInfo {
  name: string;
  avatarUrl: string | null;
}

/** Map of user id → member info, passed to room feature components. */
export type MemberMap = Record<string, MemberInfo>;
