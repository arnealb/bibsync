"use client";

import { Footprints, Loader2, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveStepSession } from "@/app/_actions/steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { createStepDetector } from "@/lib/steps/pedometer";

type Status = "idle" | "running" | "saving" | "denied" | "unsupported";

/** iOS 13+ gates the motion sensor behind a permission prompt. */
interface MotionPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export function StepCounter({
  roomId,
  onSaved,
}: {
  roomId: string;
  onSaved?: (steps: number) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [count, setCount] = useState(0);
  const detectorRef = useRef(createStepDetector());
  const countRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Flush the running count into state a few times a second — far cheaper than
  // a setState on every motion event (which can fire ~60×/s).
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setCount(countRef.current), 200);
    return () => window.clearInterval(id);
  }, [status]);

  // Always detach the motion listener if the component unmounts mid-count.
  useEffect(() => () => cleanupRef.current?.(), []);

  function handleMotion(event: DeviceMotionEvent) {
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    countRef.current += detectorRef.current.push(magnitude, event.timeStamp);
  }

  async function start() {
    const DME =
      typeof window !== "undefined"
        ? (window.DeviceMotionEvent as unknown as MotionPermission | undefined)
        : undefined;
    if (!DME) {
      setStatus("unsupported");
      return;
    }
    if (typeof DME.requestPermission === "function") {
      try {
        const result = await DME.requestPermission();
        if (result !== "granted") {
          setStatus("denied");
          return;
        }
      } catch {
        setStatus("denied");
        return;
      }
    }

    detectorRef.current.reset();
    countRef.current = 0;
    setCount(0);
    window.addEventListener("devicemotion", handleMotion);
    cleanupRef.current = () =>
      window.removeEventListener("devicemotion", handleMotion);
    setStatus("running");
  }

  async function stop() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    const steps = countRef.current;

    if (steps <= 0) {
      setStatus("idle");
      setCount(0);
      return;
    }

    setStatus("saving");
    const result = await saveStepSession({ roomId, steps, source: "browser" });
    if (result.ok) {
      toast.success(copy.steps.saved(steps));
      onSaved?.(steps);
    } else {
      toast.error(result.error);
    }
    countRef.current = 0;
    setCount(0);
    setStatus("idle");
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <Footprints
          className={
            status === "running"
              ? "size-10 animate-pulse text-emerald-500"
              : "size-10 text-muted-foreground"
          }
        />

        {status === "running" || status === "saving" ? (
          <div>
            <p className="text-5xl font-bold tabular-nums">{count}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.steps.counting}
            </p>
          </div>
        ) : (
          <p className="max-w-xs text-sm text-muted-foreground">
            {status === "denied"
              ? copy.steps.denied
              : status === "unsupported"
                ? copy.steps.unsupported
                : copy.steps.hint}
          </p>
        )}

        {status === "running" ? (
          <Button onClick={stop} variant="destructive" size="lg">
            <Square /> {copy.steps.stop}
          </Button>
        ) : status === "saving" ? (
          <Button disabled size="lg">
            <Loader2 className="animate-spin" /> {copy.steps.saving}
          </Button>
        ) : (
          <Button onClick={start} size="lg">
            <Play /> {copy.steps.start}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
