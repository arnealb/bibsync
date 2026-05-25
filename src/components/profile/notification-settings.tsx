"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";

import {
  removePushSubscription,
  savePushSubscription,
  updateNotificationPrefs,
} from "@/app/_actions/push";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { copy } from "@/lib/copy";
import {
  currentPushEndpoint,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

export function NotificationSettings({
  notifyProposals: initialProposals,
  notifyFood: initialFood,
}: {
  notifyProposals: boolean;
  notifyFood: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState({
    proposals: initialProposals,
    food: initialFood,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve(); // avoid synchronous setState in the effect
      const ok = pushSupported();
      const endpoint = ok ? await currentPushEndpoint() : null;
      if (!active) return;
      setSupported(ok);
      setEnabled(Boolean(endpoint));
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const keys = await subscribeToPush();
      if (!keys) {
        toast.error(
          Notification.permission === "denied"
            ? copy.push.denied
            : copy.push.error,
        );
        return;
      }
      const result = await savePushSubscription(keys);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEnabled(true);
      toast.success(copy.push.enabledToast);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await removePushSubscription(endpoint);
      setEnabled(false);
      toast.success(copy.push.disabledToast);
    } finally {
      setBusy(false);
    }
  }

  function togglePref(key: "proposals" | "food", value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    updateNotificationPrefs({
      notifyProposals: next.proposals,
      notifyFood: next.food,
    }).then((result) => {
      if (!result.ok) {
        setPrefs(prefs);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-muted-foreground" />
        <h2 className="font-medium">{copy.push.title}</h2>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {copy.push.subtitle}
      </p>

      {!supported ? (
        <p className="text-sm text-muted-foreground">{copy.push.unsupported}</p>
      ) : enabled ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={disable}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BellOff className="size-4" />
          )}
          {copy.push.disable}
        </Button>
      ) : (
        <Button size="sm" disabled={busy} onClick={enable}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bell className="size-4" />
          )}
          {copy.push.enable}
        </Button>
      )}

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="pref-proposals" className="font-normal">
            {copy.push.prefProposals}
          </Label>
          <Switch
            id="pref-proposals"
            checked={prefs.proposals}
            onCheckedChange={(v) => togglePref("proposals", v)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="pref-food" className="font-normal">
            {copy.push.prefFood}
          </Label>
          <Switch
            id="pref-food"
            checked={prefs.food}
            onCheckedChange={(v) => togglePref("food", v)}
          />
        </div>
      </div>
    </div>
  );
}
