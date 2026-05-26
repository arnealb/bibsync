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
}

export function GameCard({
  href,
  title,
  subtitle,
  emoji,
  myBest,
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
          {copy.games.yourBest}:{" "}
          <span className="font-medium text-foreground">
            {myBest ?? copy.games.noBest}
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
