import Link from "next/link";

import { cn } from "@/lib/utils";

/** Wraps a member's name/avatar in a link to their public profile page. */
export function ProfileLink({
  userId,
  className,
  children,
}: {
  userId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/app/users/${userId}`}
      className={cn("hover:underline", className)}
    >
      {children}
    </Link>
  );
}
