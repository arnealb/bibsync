"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createOffer } from "@/app/_actions/marketplace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import {
  OFFER_PRESETS,
  REQUEST_PRESETS,
  type OfferKind,
} from "@/lib/marketplace/config";
import { cn } from "@/lib/utils";
import type { ServiceOffer } from "@/types/database";

export function CreateOfferForm({
  roomId,
  onCreated,
}: {
  roomId: string;
  onCreated: (offer: ServiceOffer) => void;
}) {
  const [kind, setKind] = useState<OfferKind>("offer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(200);
  const [pending, start] = useTransition();

  const presets = kind === "offer" ? OFFER_PRESETS : REQUEST_PRESETS;

  function submit() {
    if (!title.trim() || price < 1) return;
    start(async () => {
      const res = await createOffer({
        roomId,
        kind,
        title: title.trim(),
        description: description.trim(),
        price,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(copy.marketplace.posted);
      setTitle("");
      setDescription("");
      onCreated(res.offer);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <p className="text-sm font-semibold">{copy.marketplace.newTitle}</p>

        {/* Kind toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["offer", "request"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition",
                kind === k
                  ? "border-primary bg-primary/10"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="font-medium">
                {k === "offer"
                  ? copy.marketplace.kindOffer
                  : copy.marketplace.kindRequest}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {k === "offer"
                  ? copy.marketplace.kindOfferHint
                  : copy.marketplace.kindRequestHint}
              </span>
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => {
                setTitle(p.title);
                setDescription(p.description);
                setPrice(p.price);
              }}
              className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
            >
              {p.emoji} {p.title}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offer-title">{copy.marketplace.titleLabel}</Label>
          <Input
            id="offer-title"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.marketplace.titlePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offer-desc">{copy.marketplace.descLabel}</Label>
          <Textarea
            id="offer-desc"
            value={description}
            maxLength={200}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.marketplace.descPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offer-price">
            {kind === "offer"
              ? copy.marketplace.priceLabel
              : copy.marketplace.budgetLabel}
          </Label>
          <Input
            id="offer-price"
            type="number"
            min={1}
            value={price}
            onChange={(e) =>
              setPrice(Math.max(1, Math.floor(Number(e.target.value) || 0)))
            }
          />
        </div>

        <Button
          className="w-full"
          disabled={pending || !title.trim() || price < 1}
          onClick={submit}
        >
          {pending ? copy.marketplace.posting : copy.marketplace.post}
        </Button>
      </CardContent>
    </Card>
  );
}
