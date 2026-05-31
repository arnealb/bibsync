import type { ReactNode } from "react";

import { effectClassName } from "@/lib/cosmetics/effects";
import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { cn } from "@/lib/utils";

/**
 * Renders a member's display name with their equipped cosmetics — name colour
 * or animated effect, plus a title flair chip. Pair with {@link UserAvatar}
 * (pass the same loadout) so cosmetics show everywhere a user appears.
 */
export function UserName({
  name,
  loadout,
  className,
  suffix,
}: {
  name: string;
  loadout?: ResolvedLoadout | null;
  className?: string;
  /** Extra inline content after the name (e.g. " (jij)"). */
  suffix?: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span
        className={cn(
          "truncate",
          effectClassName(loadout?.effect?.value),
          className,
        )}
        style={
          loadout?.color && !loadout?.effect
            ? { color: loadout.color.value }
            : undefined
        }
      >
        {name}
        {suffix}
      </span>
      {loadout?.title && (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold whitespace-nowrap">
          {loadout.title.value}
        </span>
      )}
    </span>
  );
}
