import Link from "next/link";
import { CalendarClock, Users, Vote } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const features = [
  { icon: CalendarClock, label: "Plan pauzes op het kwartier" },
  { icon: Vote, label: "Stem samen op het beste moment" },
  { icon: Users, label: "Zie wie er studeert of pauzeert" },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">
          {copy.app.name}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button render={<Link href="/login" />} variant="ghost">
            {copy.nav.login}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {copy.landing.heroTitle}
          </h1>
          <p className="text-lg text-muted-foreground">
            {copy.landing.heroSubtitle}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              render={<Link href="/register" />}
              size="lg"
              className="w-full sm:w-auto"
            >
              {copy.landing.ctaPrimary}
            </Button>
            <Button
              render={<Link href="/login" />}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              {copy.landing.ctaSecondary}
            </Button>
          </div>
        </div>

        <ul className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-2 rounded-lg border bg-card p-5 text-sm text-card-foreground"
            >
              <Icon className="size-6 text-primary" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted-foreground">
        {copy.app.tagline}
      </footer>
    </div>
  );
}
