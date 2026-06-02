import type { DayTotal } from "@/lib/screen-time/aggregate";
import { formatScreenTime, toMinutes } from "@/lib/screen-time/format";
import { formatDayShort } from "@/lib/time";

/**
 * A compact bar chart of the room's daily screen time. Pure presentational —
 * server-renderable. Bars scale to the busiest day; a tiny stub keeps days with
 * a little activity visible, empty days show nothing.
 */
export function ScreenTimeChart({ daily }: { daily: DayTotal[] }) {
  const max = Math.max(1, ...daily.map((d) => d.seconds));

  return (
    <div className="space-y-2">
      <div className="flex h-44 items-end gap-1.5">
        {daily.map((d) => {
          const pct = (d.seconds / max) * 100;
          const height = d.seconds > 0 ? Math.max(pct, 4) : 0;
          const minutes = toMinutes(d.seconds);
          return (
            <div
              key={d.day}
              className="flex h-full flex-1 items-end"
              title={`${formatDayShort(d.day)}: ${formatScreenTime(d.seconds)}`}
            >
              <div className="flex w-full flex-col items-center justify-end">
                {minutes > 0 && (
                  <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {minutes}
                  </span>
                )}
                <div
                  className="w-full rounded-t bg-gradient-to-t from-amber-500/50 to-amber-400 transition-[height]"
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {daily.map((d) => (
          <span
            key={d.day}
            className="flex-1 text-center text-[10px] tabular-nums text-muted-foreground"
          >
            {d.day.slice(8)}
          </span>
        ))}
      </div>
    </div>
  );
}
