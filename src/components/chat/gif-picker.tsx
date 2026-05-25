"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

interface GiphyImage {
  url?: string;
}
interface GiphyGif {
  id: string;
  title?: string;
  images?: Record<string, GiphyImage>;
}
interface GifItem {
  id: string;
  preview: string;
  full: string;
  title: string;
}

/** Renders nothing when no Giphy key is configured. */
export function GifPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !GIPHY_KEY) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?limit=24&rating=pg-13`;
      try {
        const res = await fetch(`${endpoint}&api_key=${GIPHY_KEY}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { data?: GiphyGif[] };
        setGifs(
          (json.data ?? [])
            .map((gif) => ({
              id: gif.id,
              preview:
                gif.images?.fixed_width_small?.url ??
                gif.images?.fixed_height_small?.url ??
                "",
              full:
                gif.images?.fixed_height?.url ??
                gif.images?.original?.url ??
                "",
              title: gif.title ?? "gif",
            }))
            .filter((gif) => gif.full && gif.preview),
        );
      } catch {
        // aborted or network error — leave the current list
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  if (!GIPHY_KEY) return null;

  function pick(url: string) {
    onSelect(url);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={copy.chat.gif.button}
          />
        }
      >
        <Sparkles />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.chat.gif.title}</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.chat.gif.search}
          autoFocus
        />
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => pick(gif.full)}
              className="overflow-hidden rounded-md border outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gif.preview}
                alt={gif.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
          {loading && gifs.length === 0 && (
            <div className="col-span-full flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {!loading && gifs.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              {copy.chat.gif.empty}
            </p>
          )}
        </div>
        <p className="text-right text-[10px] text-muted-foreground">
          {copy.chat.gif.poweredBy}
        </p>
      </DialogContent>
    </Dialog>
  );
}
