"use client";

import { Check, Copy, KeyRound, Loader2, Share } from "lucide-react";
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
import { STEP_CODE_SEPARATOR } from "@/lib/validation/steps";

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({
  value,
  label,
  full = false,
}: {
  value: string;
  label: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size={full ? "default" : "sm"}
      className={full ? "w-full" : undefined}
      aria-label={label}
      onClick={async () => {
        if (await copyToClipboard(value)) {
          setCopied(true);
          toast.success(copy.steps.health.copied);
          window.setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error(copy.common.genericError);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {full ? label : null}
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
  installUrl,
  initialToken,
}: {
  roomId: string;
  endpoint: string;
  installUrl: string;
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

  const code = token ? `${token}${STEP_CODE_SEPARATOR}${roomId}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.steps.health.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {copy.steps.health.intro}
        </p>

        <Button
          type="button"
          onClick={generate}
          disabled={busy}
          variant="outline"
        >
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {token ? copy.steps.health.regenerate : copy.steps.health.generate}
        </Button>

        {token ? (
          <div className="space-y-4 rounded-lg border p-3">
            {/* One-tap path: add the prebuilt shortcut, paste the code once. */}
            {installUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {copy.steps.health.oneTapTitle}
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {copy.steps.health.oneTapSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <CopyButton
                  value={code}
                  label={copy.steps.health.copyCode}
                  full
                />
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<a href={installUrl} />}
                >
                  <Share />
                  {copy.steps.health.addToShortcuts}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {copy.steps.health.notReady}
              </p>
            )}

            <p className="text-xs text-amber-600 dark:text-amber-500">
              ⚠️ {copy.steps.health.warning}
            </p>

            {/* Power-user / fallback: build the shortcut by hand. */}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                {copy.steps.health.manualTitle}
              </summary>
              <div className="mt-3 space-y-3">
                <CodeRow
                  label={copy.steps.health.endpointLabel}
                  value={endpoint}
                />
                <CodeRow label={copy.steps.health.codeLabel} value={code} />
                <CodeRow
                  label={copy.steps.health.bodyLabel}
                  value={JSON.stringify({ code, steps: 1234 })}
                />
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {copy.steps.health.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </details>
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
