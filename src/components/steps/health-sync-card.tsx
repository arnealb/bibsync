"use client";

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { regenerateHealthToken } from "@/app/_actions/steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(copy.steps.health.copied);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(copy.common.genericError);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <CopyButton value={value} label={copy.steps.health.copy} />
      </div>
    </div>
  );
}

export function HealthSyncCard({
  roomId,
  endpoint,
  initialToken,
}: {
  roomId: string;
  endpoint: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const result = await regenerateHealthToken();
    if (result.ok) {
      setToken(result.token);
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.steps.health.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {copy.steps.health.intro}
        </p>

        <Button type="button" onClick={generate} disabled={busy} variant="outline">
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {token ? copy.steps.health.regenerate : copy.steps.health.generate}
        </Button>

        {token ? (
          <div className="space-y-3 rounded-lg border p-3">
            <CodeRow label={copy.steps.health.endpointLabel} value={endpoint} />
            <CodeRow label={copy.steps.health.tokenLabel} value={token} />
            <CodeRow
              label={copy.steps.health.bodyLabel}
              value={JSON.stringify({ token, roomId, steps: 1234 })}
            />
            <p className="text-xs text-amber-600 dark:text-amber-500">
              ⚠️ {copy.steps.health.warning}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {copy.steps.health.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.steps.health.noToken}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
