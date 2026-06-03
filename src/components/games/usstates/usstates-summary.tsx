import { copy } from "@/lib/copy";
import { USSTATES_TOTAL } from "@/lib/usstates/config";
import { US_STATES } from "@/lib/usstates/states";

/** End-of-round summary: outcome line, score, and the list of missed states. */
export function UsStatesSummary({
  found,
  secondsLeft,
}: {
  found: ReadonlySet<string>;
  secondsLeft: number;
}) {
  const missed = US_STATES.filter((s) => !found.has(s.code));
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="font-medium">
        {found.size === USSTATES_TOTAL
          ? copy.usstates.finishedAll
          : secondsLeft === 0
            ? copy.usstates.finishedTime
            : copy.usstates.finishedGaveUp}
      </p>
      <p className="text-sm text-muted-foreground">
        {copy.usstates.resultLine(found.size, USSTATES_TOTAL)}
      </p>
      {missed.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">{copy.usstates.missedHeading}:</span>{" "}
          <span className="text-muted-foreground">
            {missed.map((s) => s.name).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
