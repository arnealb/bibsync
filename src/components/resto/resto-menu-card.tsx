import { UtensilsCrossed } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { cleanPrice, mainsByKind, soupNames } from "@/lib/resto/format";
import type { RestoDay } from "@/lib/resto/types";

/**
 * "Menu van de dag" — the UGent resto (Sterre / De Brug) menu for today,
 * shown in the room dashboard sidebar. Renders nothing when there's no menu
 * (weekend/holiday/feed error); a closed note when the resto is shut.
 */
export function RestoMenuCard({ menu }: { menu: RestoDay | null }) {
  if (!menu) return null;

  const sections = mainsByKind(menu);
  const soups = soupNames(menu);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="size-4 text-orange-500" />
          {copy.resto.title}
        </CardTitle>
        <CardDescription>{copy.resto.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!menu.open ? (
          <p className="text-sm text-muted-foreground">{copy.resto.closed}</p>
        ) : (
          <>
            {sections.map((section) => (
              <div key={section.kind}>
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  {copy.resto.kinds[section.kind] ?? section.kind}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {section.meals.map((meal, index) => {
                    const price = cleanPrice(meal.price);
                    return (
                      <li
                        key={`${meal.name}-${index}`}
                        className="flex items-baseline justify-between gap-2 text-sm"
                      >
                        <span>{meal.name}</span>
                        {price ? (
                          <span className="shrink-0 text-muted-foreground">
                            {price}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {soups.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  {copy.resto.soup}
                </p>
                <p className="mt-1 text-sm">{soups.join(" · ")}</p>
              </div>
            ) : null}

            {menu.vegetables.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  {copy.resto.vegetables}
                </p>
                <p className="mt-1 text-sm">{menu.vegetables.join(" · ")}</p>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
