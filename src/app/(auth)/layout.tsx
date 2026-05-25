import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Logged-in users have no business on the login/register pages.
  const ctx = await getAuthContext();
  if (ctx) redirect("/app");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {copy.app.name}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
