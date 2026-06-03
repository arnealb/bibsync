import { cn } from "@/lib/utils";
import { US_PATHS, US_VIEWBOX } from "@/lib/usstates/map";
import { stateByCode } from "@/lib/usstates/states";

interface UsStatesMapProps {
  /** Postal codes the player has correctly named. */
  found: ReadonlySet<string>;
  /** When true, not-yet-found states are revealed in red with their label. */
  revealed: boolean;
}

/** Label text: postal code for cramped (small) states, else the full name. */
function labelFor(code: string): string {
  const s = stateByCode(code);
  if (!s) return code;
  return s.small ? s.code : s.name;
}

/** The blank US map. Found states are green + labelled; on reveal the misses
 *  turn red + labelled. Purely presentational. */
export function UsStatesMap({ found, revealed }: UsStatesMapProps) {
  return (
    <svg
      viewBox={US_VIEWBOX}
      role="img"
      aria-label="Kaart van de Verenigde Staten"
      className="h-auto w-full select-none"
    >
      {US_PATHS.map((p) => {
        const isFound = found.has(p.code);
        return (
          <path
            key={p.code}
            d={p.d}
            className={cn(
              "stroke-background transition-colors",
              isFound
                ? "fill-emerald-500"
                : revealed
                  ? "fill-red-400"
                  : "fill-muted-foreground/25",
            )}
            strokeWidth={1}
          />
        );
      })}
      {US_PATHS.map((p) => {
        const isFound = found.has(p.code);
        if (!isFound && !revealed) return null;
        const small = stateByCode(p.code)?.small ?? false;
        return (
          <text
            key={`t-${p.code}`}
            x={p.label.x}
            y={p.label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={small ? 9 : 11}
            className={cn(
              "pointer-events-none font-semibold",
              isFound ? "fill-white" : "fill-red-900",
            )}
          >
            {labelFor(p.code)}
          </text>
        );
      })}
    </svg>
  );
}
