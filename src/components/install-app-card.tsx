"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

export function InstallAppCard() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);

    // Deferred so we don't call setState synchronously inside the effect.
    const id = window.setTimeout(() => {
      if (isStandalone()) {
        setInstalled(true);
        return;
      }
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      setMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener(
        "beforeinstallprompt",
        onPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || installed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-muted-foreground" />
        <h2 className="font-medium">{copy.pwa.title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{copy.pwa.subtitle}</p>

      {deferred ? (
        <Button size="sm" className="mt-3" onClick={install}>
          <Download className="size-4" />
          {copy.pwa.install}
        </Button>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-sm">
          {isIos && <Share className="mt-0.5 size-4 shrink-0" />}
          <span className="text-muted-foreground">
            {isIos ? copy.pwa.iosHint : copy.pwa.genericHint}
          </span>
        </p>
      )}
    </div>
  );
}
