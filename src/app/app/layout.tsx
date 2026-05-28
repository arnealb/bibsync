import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { DailyClaimer } from "@/components/bibcoins/daily-claimer";
import { HourlyClaimer } from "@/components/bibcoins/hourly-claimer";
import { getAuthContext } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <HourlyClaimer />
      <DailyClaimer />
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
