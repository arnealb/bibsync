import {
  SUIT_IS_RED,
  SUIT_SYMBOL,
  cardSuit,
  rankLabel,
  type Card,
} from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card?: Card; // omit for a face-down card
  size?: "sm" | "md";
}

export function PlayingCard({ card, size = "md" }: PlayingCardProps) {
  const dims =
    size === "sm" ? "h-10 w-7 text-xs" : "h-14 w-10 text-sm";

  if (!card) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-gradient-to-br from-indigo-600 to-indigo-800",
          dims,
        )}
        aria-label="verdekte kaart"
      >
        <span className="text-base text-white/70">♠</span>
      </div>
    );
  }

  const suit = cardSuit(card);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-border bg-white font-semibold leading-none shadow-sm",
        SUIT_IS_RED[suit] ? "text-red-600" : "text-neutral-900",
        dims,
      )}
      aria-label={card}
    >
      <span>{rankLabel(card)}</span>
      <span className="text-base">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}
