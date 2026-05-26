import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { getInitials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const RAINBOW =
  "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #38bdf8, #a855f7, #ec4899, #ef4444)";

/** Avatar that shows the profile picture when set, else initials. Optionally
 *  decorated with equipped cosmetics (frame ring + badge/accessory/pet). */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
  loadout,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  loadout?: ResolvedLoadout | null;
}) {
  const avatar = (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={fallbackClassName}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  const frame = loadout?.frame;
  const badge = loadout?.badge;
  const accessory = loadout?.accessory;
  const pet = loadout?.pet;
  if (!frame && !badge && !accessory && !pet) return avatar;

  return (
    <span className="relative inline-flex shrink-0">
      {frame ? (
        <span
          className="inline-flex rounded-full p-[2px]"
          style={{
            background: frame.value === "rainbow" ? RAINBOW : frame.value,
          }}
        >
          {avatar}
        </span>
      ) : (
        avatar
      )}
      {accessory && (
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-xs leading-none">
          {accessory.value}
        </span>
      )}
      {badge && (
        <span
          className={cn(
            "pointer-events-none absolute -bottom-1 -right-1 text-[11px] leading-none",
          )}
        >
          {badge.value}
        </span>
      )}
      {pet && (
        <span className="pointer-events-none absolute -bottom-1 -left-1 text-[11px] leading-none">
          {pet.value}
        </span>
      )}
    </span>
  );
}
