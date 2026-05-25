"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Toggles between light and dark mode. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className="size-5 hidden dark:block" />
      <Moon className="size-5 block dark:hidden" />
    </Button>
  );
}
