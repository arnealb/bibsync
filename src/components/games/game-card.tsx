import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

interface GameCardProps {
  href: string;
  title: string;
  subtitle: string;
  emoji: string;
  myBest: number | null;
  /** Overrides the "Jouw beste" label (e.g. "Jouw fiches" for poker). */
  statLabel?: string;
  /** Pre-formatted stat (e.g. Minesweeper best times); wins over `myBest`. */
  myBestDisplay?: string;
}

export function GameCard({
  href,
  title,
  subtitle,
  emoji,
  myBest,
  statLabel,
  myBestDisplay,
}: GameCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden className="text-xl">
            {emoji}
          </span>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {statLabel ?? copy.games.yourBest}:{" "}
          <span className="font-medium text-foreground">
            {myBestDisplay ?? myBest ?? copy.games.noBest}
          </span>
        </p>
        <Button
          render={<Link href={href} />}
          nativeButton={false}
          size="sm"
        >
          {copy.games.play}
        </Button>
      </CardContent>
    </Card>
  );
}
