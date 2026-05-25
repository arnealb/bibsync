import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuthContext, getInitials } from "@/lib/auth";
import { copy } from "@/lib/copy";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const name = ctx.profile?.display_name ?? ctx.user.email ?? "?";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/app" className="font-semibold tracking-tight">
            {copy.app.name}
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/app/profile"
              aria-label={copy.nav.profile}
              className="rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Avatar className="size-9">
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
