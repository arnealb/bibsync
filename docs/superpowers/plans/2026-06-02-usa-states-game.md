# USA Staten — kaartquiz · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sporcle-style "USA Staten" game to the Games library: a blank US map where the player types the 50 state names within a 5-minute timer; correct states turn green and get labelled, each fresh state pays +10 bibcoins (capped at 10/state/day), and the best score is saved.

**Architecture:** Pure data + matching logic in `src/lib/usstates/` (unit-tested). The map is one static, public-domain inline SVG (50 `<path id=POSTAL>`), its geometry generated once into `src/lib/usstates/map.ts` by a one-off script. Coins are awarded server-authoritatively via the idempotent bibcoin ledger (award key = `usstates:<user>:<code>:<brussels-date>` → one payout per state per day). The best score reuses the existing `game_scores` table (`game_key: "usstates"`); no new migration. A client component owns the timer/input/state-machine.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions), React 19, TypeScript strict, Zod, Tailwind v4 + base-ui/shadcn, Supabase, Vitest.

---

## Conventions reminder (read once)

- Server actions in `src/app/_actions/`, `"use server"`, Zod-parse → mutate → return `ActionResult` or a specialised result.
- Zod schemas in `src/lib/validation/`. Re-validate server-side even if the client did.
- All Dutch UI strings in `src/lib/copy.ts`. Code/comments in English. No hardcoded UI strings in components.
- Client components only when needed (`"use client"`). Keep files ≤~150 lines.
- Verify with `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` (local `pnpm build` can fail on `next/font` — that's expected; rely on Vercel for the real build).
- Run a single test file with: `pnpm exec vitest run <path>`.

## File structure (what gets created/modified)

**Create**
- `src/lib/usstates/states.ts` — the 50 states (code, English name, `small` flag) + derived code set/tuple.
- `src/lib/usstates/config.ts` — constants (duration, coins-per-state).
- `src/lib/usstates/match.ts` — `normalizeGuess`, `matchState`.
- `src/lib/usstates/map.ts` — **generated** SVG geometry (viewBox + per-state path + label anchor).
- `scripts/build-us-map.mjs` — one-off generator for `map.ts` from a source SVG.
- `tests/unit/usstates-match.test.ts` — matching + data tests.
- `tests/unit/usstates-map.test.ts` — geometry integrity tests.
- `src/app/_actions/usstates.ts` — `claimStateCoin` server action.
- `src/components/games/usstates/usstates-map.tsx` — presentational SVG.
- `src/components/games/usstates/usstates-game.tsx` — client game (timer/input/state-machine).
- `src/app/app/rooms/[id]/games/usstates/page.tsx` — server page.

**Modify**
- `src/lib/validation/games.ts` — add `"usstates"` to `GAME_KEYS`; add `claimStateCoinSchema`.
- `src/app/_actions/games.ts` — skip arcade earning for `"usstates"`.
- `src/lib/copy.ts` — add the `usstates` copy block.
- `src/app/app/rooms/[id]/games/page.tsx` — add the `GameCard`.

---

## Task 1: State data + matching logic (TDD)

**Files:**
- Create: `src/lib/usstates/states.ts`
- Create: `src/lib/usstates/config.ts`
- Create: `src/lib/usstates/match.ts`
- Test: `tests/unit/usstates-match.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/usstates-match.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { US_STATES } from "@/lib/usstates/states";
import { matchState, normalizeGuess } from "@/lib/usstates/match";

describe("usstates data", () => {
  it("has exactly 50 states with unique codes and names", () => {
    expect(US_STATES).toHaveLength(50);
    expect(new Set(US_STATES.map((s) => s.code)).size).toBe(50);
    expect(new Set(US_STATES.map((s) => s.name)).size).toBe(50);
  });

  it("uses two-letter uppercase postal codes", () => {
    for (const s of US_STATES) expect(s.code).toMatch(/^[A-Z]{2}$/);
  });
});

describe("normalizeGuess", () => {
  it("lowercases, trims and collapses internal whitespace", () => {
    expect(normalizeGuess("  New   YORK ")).toBe("new york");
    expect(normalizeGuess("California")).toBe("california");
  });
});

describe("matchState (strict, English only)", () => {
  const none = new Set<string>();

  it("matches every canonical name case-insensitively", () => {
    for (const s of US_STATES) {
      expect(matchState(s.name, none)).toBe(s.code);
      expect(matchState(s.name.toLowerCase(), none)).toBe(s.code);
    }
  });

  it("tolerates surrounding and doubled whitespace", () => {
    expect(matchState("  north   carolina ", none)).toBe("NC");
  });

  it("rejects postal abbreviations", () => {
    expect(matchState("NY", none)).toBeNull();
    expect(matchState("ca", none)).toBeNull();
  });

  it("rejects typos (no fuzzy matching)", () => {
    expect(matchState("Californa", none)).toBeNull();
    expect(matchState("newyork", none)).toBeNull();
  });

  it("returns null for an already-found state (no double count)", () => {
    expect(matchState("California", new Set(["CA"]))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/usstates-match.test.ts`
Expected: FAIL — cannot resolve `@/lib/usstates/states` / `@/lib/usstates/match`.

- [ ] **Step 3: Create the data, config and matching modules**

Create `src/lib/usstates/states.ts`:

```ts
/** A US state: postal code, canonical English name, and whether it's too small
 *  to fit its full name on the map (shows the postal code instead). */
export interface UsState {
  code: string;
  name: string;
  small: boolean;
}

/** The 50 states. `small` = the cramped north-eastern cluster. */
export const US_STATES: readonly UsState[] = [
  { code: "AL", name: "Alabama", small: false },
  { code: "AK", name: "Alaska", small: false },
  { code: "AZ", name: "Arizona", small: false },
  { code: "AR", name: "Arkansas", small: false },
  { code: "CA", name: "California", small: false },
  { code: "CO", name: "Colorado", small: false },
  { code: "CT", name: "Connecticut", small: true },
  { code: "DE", name: "Delaware", small: true },
  { code: "FL", name: "Florida", small: false },
  { code: "GA", name: "Georgia", small: false },
  { code: "HI", name: "Hawaii", small: false },
  { code: "ID", name: "Idaho", small: false },
  { code: "IL", name: "Illinois", small: false },
  { code: "IN", name: "Indiana", small: false },
  { code: "IA", name: "Iowa", small: false },
  { code: "KS", name: "Kansas", small: false },
  { code: "KY", name: "Kentucky", small: false },
  { code: "LA", name: "Louisiana", small: false },
  { code: "ME", name: "Maine", small: false },
  { code: "MD", name: "Maryland", small: true },
  { code: "MA", name: "Massachusetts", small: true },
  { code: "MI", name: "Michigan", small: false },
  { code: "MN", name: "Minnesota", small: false },
  { code: "MS", name: "Mississippi", small: false },
  { code: "MO", name: "Missouri", small: false },
  { code: "MT", name: "Montana", small: false },
  { code: "NE", name: "Nebraska", small: false },
  { code: "NV", name: "Nevada", small: false },
  { code: "NH", name: "New Hampshire", small: true },
  { code: "NJ", name: "New Jersey", small: true },
  { code: "NM", name: "New Mexico", small: false },
  { code: "NY", name: "New York", small: false },
  { code: "NC", name: "North Carolina", small: false },
  { code: "ND", name: "North Dakota", small: false },
  { code: "OH", name: "Ohio", small: false },
  { code: "OK", name: "Oklahoma", small: false },
  { code: "OR", name: "Oregon", small: false },
  { code: "PA", name: "Pennsylvania", small: false },
  { code: "RI", name: "Rhode Island", small: true },
  { code: "SC", name: "South Carolina", small: false },
  { code: "SD", name: "South Dakota", small: false },
  { code: "TN", name: "Tennessee", small: false },
  { code: "TX", name: "Texas", small: false },
  { code: "UT", name: "Utah", small: false },
  { code: "VT", name: "Vermont", small: true },
  { code: "VA", name: "Virginia", small: false },
  { code: "WA", name: "Washington", small: false },
  { code: "WV", name: "West Virginia", small: false },
  { code: "WI", name: "Wisconsin", small: false },
  { code: "WY", name: "Wyoming", small: false },
];

/** Fast membership check for a postal code. */
export const US_STATE_CODES: ReadonlySet<string> = new Set(
  US_STATES.map((s) => s.code),
);

/** Tuple form for `z.enum(...)` (single source of truth for the codes). */
export const US_STATE_CODE_TUPLE = US_STATES.map((s) => s.code) as [
  string,
  ...string[],
];

/** Lookup a state by its postal code. */
export function stateByCode(code: string): UsState | undefined {
  return US_STATES.find((s) => s.code === code);
}
```

Create `src/lib/usstates/config.ts`:

```ts
import { US_STATES } from "@/lib/usstates/states";

/** Round length in seconds (5:00 countdown). */
export const USSTATES_DURATION_SECONDS = 300;

/** Bibcoins paid per freshly-named state (capped to once per state per day). */
export const USSTATES_COINS_PER_STATE = 10;

/** Total states to name. */
export const USSTATES_TOTAL = US_STATES.length;
```

Create `src/lib/usstates/match.ts`:

```ts
import { US_STATES } from "@/lib/usstates/states";

/** Strip case and normalise whitespace; nothing else (matching stays strict). */
export function normalizeGuess(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const BY_NORMALIZED_NAME = new Map(
  US_STATES.map((s) => [normalizeGuess(s.name), s.code]),
);

/**
 * Strict English match. Returns the postal code of the state the guess names,
 * or null when it matches nothing or matches an already-found state. No
 * abbreviations, no fuzzy/typo tolerance.
 */
export function matchState(
  guess: string,
  found: ReadonlySet<string>,
): string | null {
  const code = BY_NORMALIZED_NAME.get(normalizeGuess(guess));
  if (!code || found.has(code)) return null;
  return code;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/usstates-match.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/usstates/states.ts src/lib/usstates/config.ts src/lib/usstates/match.ts tests/unit/usstates-match.test.ts
git commit -m "feat(usstates): state data + strict matching logic"
```

---

## Task 2: Map geometry (generator + generated `map.ts`)

This is the one task that pulls in an external asset. The geometry is generated once from a **public-domain** US-states SVG and committed; the integrity test guarantees it lines up with `states.ts`.

**Files:**
- Create: `scripts/build-us-map.mjs`
- Create: `src/lib/usstates/map.ts` (generated output, committed)
- Test: `tests/unit/usstates-map.test.ts`

- [ ] **Step 1: Write the failing integrity test**

Create `tests/unit/usstates-map.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { US_PATHS, US_VIEWBOX } from "@/lib/usstates/map";
import { US_STATE_CODES, US_STATES } from "@/lib/usstates/states";

describe("usstates map geometry", () => {
  it("has a non-empty viewBox", () => {
    expect(US_VIEWBOX).toMatch(/^\d/);
    expect(US_VIEWBOX.split(/\s+/)).toHaveLength(4);
  });

  it("has exactly one path per state, codes matching states.ts", () => {
    expect(US_PATHS).toHaveLength(50);
    const pathCodes = new Set(US_PATHS.map((p) => p.code));
    expect(pathCodes.size).toBe(50);
    for (const s of US_STATES) expect(pathCodes.has(s.code)).toBe(true);
    for (const p of US_PATHS) expect(US_STATE_CODES.has(p.code)).toBe(true);
  });

  it("every path has non-empty geometry and a finite label anchor", () => {
    for (const p of US_PATHS) {
      expect(p.d.length).toBeGreaterThan(10);
      expect(Number.isFinite(p.label.x)).toBe(true);
      expect(Number.isFinite(p.label.y)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/usstates-map.test.ts`
Expected: FAIL — cannot resolve `@/lib/usstates/map`.

- [ ] **Step 3: Create the generator script**

Create `scripts/build-us-map.mjs`:

```js
/**
 * One-off generator: scripts/us-states-source.svg -> src/lib/usstates/map.ts
 *
 * Expects a US-states SVG where each state is one (or more) <path d="...">
 * carrying an id that is either the postal code (e.g. "CA") or the full state
 * name (e.g. "California" / "New_York"). Public-domain sources only.
 *
 * Run: node scripts/build-us-map.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("./us-states-source.svg", import.meta.url);
const OUT = new URL("../src/lib/usstates/map.ts", import.meta.url);

const NAME_TO_CODE = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};
const CODES = new Set(Object.values(NAME_TO_CODE));

function toCode(rawId) {
  if (!rawId) return null;
  const up = rawId.trim().toUpperCase();
  if (CODES.has(up)) return up;
  const norm = rawId.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return NAME_TO_CODE[norm] ?? null;
}

const svg = readFileSync(SRC, "utf8");

const viewBox =
  svg.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1] ??
  (() => {
    const w = svg.match(/\bwidth\s*=\s*"([\d.]+)/i)?.[1];
    const h = svg.match(/\bheight\s*=\s*"([\d.]+)/i)?.[1];
    return w && h ? `0 0 ${w} ${h}` : "0 0 960 600";
  })();

// code -> { ds: string[], sx, sy, n }  (sx/sy/n accumulate a rough centroid)
const byCode = new Map();
const pairRe = /(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g;
const pathRe = /<path\b[^>]*?\bd\s*=\s*"([^"]+)"[^>]*>/gi;
const idRe = /\bid\s*=\s*"([^"]+)"/i;

let m;
while ((m = pathRe.exec(svg))) {
  const d = m[1];
  const code = toCode(m[0].match(idRe)?.[1] ?? null);
  if (!code) continue;
  if (!byCode.has(code)) byCode.set(code, { ds: [], sx: 0, sy: 0, n: 0 });
  const e = byCode.get(code);
  e.ds.push(d);
  let p;
  while ((p = pairRe.exec(d))) {
    e.sx += parseFloat(p[1]);
    e.sy += parseFloat(p[2]);
    e.n += 1;
  }
}

const rows = [...byCode.entries()]
  .map(([code, e]) => ({
    code,
    d: e.ds.join(" "),
    label: {
      x: e.n ? Number((e.sx / e.n).toFixed(1)) : 0,
      y: e.n ? Number((e.sy / e.n).toFixed(1)) : 0,
    },
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const missing = [...CODES].filter((c) => !rows.some((r) => r.code === c));
console.log(`matched ${rows.length}/50` + (missing.length ? `  MISSING: ${missing.join(",")}` : ""));
if (rows.length !== 50) {
  console.error("Source SVG did not yield 50 per-state paths. Check the id scheme / source.");
  process.exit(1);
}

const ts = `// AUTO-GENERATED by scripts/build-us-map.mjs — do not edit by hand.
export interface StatePath {
  code: string;
  d: string;
  label: { x: number; y: number };
}

export const US_VIEWBOX = ${JSON.stringify(viewBox)};

export const US_PATHS: StatePath[] = ${JSON.stringify(rows, null, 2)};
`;
writeFileSync(OUT, ts);
console.log(`wrote ${OUT.pathname}`);
```

- [ ] **Step 4: Obtain a public-domain source SVG**

Get a US-states SVG where each state is a `<path>` with an `id` (postal code or full name), licensed **public domain**, and save it to `scripts/us-states-source.svg`.

Recommended: the Wikimedia **"Blank US Map (states only)"** (public domain). Use WebSearch/WebFetch to locate the current raw `.svg` URL, then download it, e.g.:

```bash
curl -L -o scripts/us-states-source.svg "<public-domain-us-states-svg-url>"
```

Acceptance for this step: the file exists and contains `<path` elements with `id="…"` per state. If a candidate nests ids on `<g>` wrappers instead of on `<path>`, pick a different source (per-path ids), or flatten the ids onto the paths before running the script. (Fallback option if no suitable pre-projected SVG is found: render the public-domain `us-atlas` TopoJSON through `d3-geo`'s `geoAlbersUsa` in a throwaway script to emit the same `<path id=POSTAL>` shape, then feed that SVG to this generator.)

- [ ] **Step 5: Generate `map.ts`**

Run: `node scripts/build-us-map.mjs`
Expected: prints `matched 50/50` and `wrote …/src/lib/usstates/map.ts`. If it prints `MISSING: …`, fix the id handling / source and re-run until 50/50.

- [ ] **Step 6: Run the integrity test to verify it passes**

Run: `pnpm exec vitest run tests/unit/usstates-map.test.ts`
Expected: PASS.

- [ ] **Step 7: Sanity-check label anchors (quick visual)**

The centroid is a rough average; a few concave states (e.g. FL, LA, MI) may sit slightly off. That's acceptable for now (labels are small; small states show only their postal code). If any anchor is clearly outside its state, hand-edit that single entry's `label` in `src/lib/usstates/map.ts` — it's plain data.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-us-map.mjs scripts/us-states-source.svg src/lib/usstates/map.ts tests/unit/usstates-map.test.ts
git commit -m "feat(usstates): generated US map geometry + integrity test"
```

---

## Task 3: Validation + coin-claim server action

**Files:**
- Modify: `src/lib/validation/games.ts`
- Create: `src/app/_actions/usstates.ts`
- Modify: `src/app/_actions/games.ts:40-49`

- [ ] **Step 1: Add the game key and claim schema**

In `src/lib/validation/games.ts`, add `"usstates"` to `GAME_KEYS` and append the claim schema. Final file:

```ts
import { z } from "zod";

import { US_STATE_CODE_TUPLE } from "@/lib/usstates/states";

export const GAME_KEYS = [
  "snake",
  "petconnect",
  "flappy",
  "tetris",
  "2048",
  "usstates",
] as const;
export const gameKeySchema = z.enum(GAME_KEYS);
export type GameKey = z.infer<typeof gameKeySchema>;

export const submitScoreSchema = z.object({
  roomId: z.string().uuid(),
  gameKey: gameKeySchema,
  score: z.number().int().min(0).max(100_000),
  cheated: z.boolean().optional(),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

export const claimStateCoinSchema = z.object({
  roomId: z.string().uuid(),
  code: z.enum(US_STATE_CODE_TUPLE),
});

export type ClaimStateCoinInput = z.infer<typeof claimStateCoinSchema>;
```

- [ ] **Step 2: Create the claim action**

Create `src/app/_actions/usstates.ts`:

```ts
"use server";

import { awardBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { todayInBrussels } from "@/lib/time";
import { USSTATES_COINS_PER_STATE } from "@/lib/usstates/config";
import {
  claimStateCoinSchema,
  type ClaimStateCoinInput,
} from "@/lib/validation/games";

export type ClaimStateCoinResult =
  | { ok: true; balance: number; awarded: boolean }
  | { ok: false; error: string };

/**
 * Award the per-state bibcoins for a correctly named state. The award is keyed
 * by (user, state, Brussels date), so the idempotent ledger pays each state at
 * most once per day — replaying or hammering this never exceeds the cap.
 */
export async function claimStateCoin(
  input: ClaimStateCoinInput,
): Promise<ClaimStateCoinResult> {
  const parsed = claimStateCoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const ref = `usstates:${access.userId}:${parsed.data.code}:${todayInBrussels()}`;
  const awarded = await awardBibcoins(
    access.userId,
    USSTATES_COINS_PER_STATE,
    "usstates",
    ref,
  );

  return { ok: true, awarded, balance: await getBibcoins(access.userId) };
}
```

- [ ] **Step 3: Skip arcade earning for `usstates` in the score submit**

In `src/app/_actions/games.ts`, the block at lines 40-49 currently routes every non-`petconnect` key through `earnFromArcade`. `usstates` pays per-state instead, so it must be excluded. Replace that block:

```ts
  if (parsed.data.gameKey === "petconnect") {
    await earnFromPetConnect(access.userId);
  } else if (parsed.data.gameKey !== "usstates") {
    await earnFromArcade(
      access.userId,
      parsed.data.gameKey,
      parsed.data.score,
      parsed.data.cheated ?? false,
    );
  }
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (Confirms the `z.enum(US_STATE_CODE_TUPLE)` typing and the new imports resolve.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/games.ts src/app/_actions/usstates.ts src/app/_actions/games.ts
git commit -m "feat(usstates): coin-claim action + game key (skip arcade earn)"
```

---

## Task 4: Dutch copy

**Files:**
- Modify: `src/lib/copy.ts` (add a sibling block next to `dice`/`games`)

- [ ] **Step 1: Add the `usstates` copy block**

In `src/lib/copy.ts`, add this block as a sibling of the other game blocks (e.g. right after the `games: { … }` block). Mind the trailing comma so the object stays valid:

```ts
  usstates: {
    title: "USA Staten",
    subtitle: "Benoem alle 50 staten van de VS op de kaart.",
    stat: "Beste score",
    instructions:
      "Typ de Engelse naam van een staat. Klopt het, dan kleurt hij groen en verschijnt de naam op de kaart. Je hebt 5 minuten — zoveel mogelijk van de 50!",
    coinHint: "+10 bibcoins per staat (max 1× per staat per dag).",
    start: "Start",
    giveUp: "Geef op",
    playAgain: "Speel opnieuw",
    placeholder: "Typ een staat…",
    found: (n: number, total: number) => `${n}/${total} staten`,
    timeLeft: (mmss: string) => `⏱ ${mmss}`,
    coinAwarded: "+10 bibcoins",
    finishedTime: "De tijd is op!",
    finishedAll: "Alle 50 — knap gedaan! 🎉",
    finishedGaveUp: "Opgegeven.",
    resultLine: (n: number, total: number) => `Je had ${n} van de ${total} staten.`,
    missedHeading: "Gemist",
    newBest: (n: number) => `Nieuwe beste score: ${n}! 🏆`,
    balance: (n: number) => `${n} bibcoins`,
  },
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/copy.ts
git commit -m "feat(usstates): Dutch copy"
```

---

## Task 5: Map component (presentational SVG)

**Files:**
- Create: `src/components/games/usstates/usstates-map.tsx`

- [ ] **Step 1: Create the map component**

Create `src/components/games/usstates/usstates-map.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { US_PATHS } from "@/lib/usstates/map";
import { stateByCode } from "@/lib/usstates/states";

interface UsStatesMapProps {
  /** Postal codes the player has correctly named. */
  found: ReadonlySet<string>;
  /** When true, not-yet-found states are revealed in red with their label. */
  revealed: boolean;
}

/** Label text for a state: postal code for cramped states, else full name. */
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
        const show = isFound || revealed;
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

import { US_VIEWBOX } from "@/lib/usstates/map";
```

> Note: move the `US_VIEWBOX` import up with the other imports at the top of the file (it is shown at the bottom only to keep the snippet readable). Final import order at the top:
> ```tsx
> import { cn } from "@/lib/utils";
> import { US_PATHS, US_VIEWBOX } from "@/lib/usstates/map";
> import { stateByCode } from "@/lib/usstates/states";
> ```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (If lint flags the duplicate/bottom import, ensure only the single top-level `import { US_PATHS, US_VIEWBOX } from "@/lib/usstates/map";` remains.)

- [ ] **Step 3: Commit**

```bash
git add src/components/games/usstates/usstates-map.tsx
git commit -m "feat(usstates): presentational map component"
```

---

## Task 6: Game component (timer / input / state-machine)

**Files:**
- Create: `src/components/games/usstates/usstates-game.tsx`

- [ ] **Step 1: Create the game component**

Create `src/components/games/usstates/usstates-game.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { claimStateCoin } from "@/app/_actions/usstates";
import { UsStatesMap } from "@/components/games/usstates/usstates-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { matchState } from "@/lib/usstates/match";
import {
  USSTATES_DURATION_SECONDS,
  USSTATES_TOTAL,
} from "@/lib/usstates/config";
import { US_STATES } from "@/lib/usstates/states";

type Status = "idle" | "running" | "ended";

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function UsStatesGame({
  roomId,
  initialBalance,
  myBest,
}: {
  roomId: string;
  initialBalance: number;
  myBest: number | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [found, setFound] = useState<ReadonlySet<string>>(new Set());
  const [value, setValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(USSTATES_DURATION_SECONDS);
  const [balance, setBalance] = useState(initialBalance);
  const inputRef = useRef<HTMLInputElement>(null);
  const endedRef = useRef(false);

  // End the round exactly once, then persist the score.
  const endGame = useCallback(
    (score: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setStatus("ended");
      void (async () => {
        const res = await submitGameScore({ roomId, gameKey: "usstates", score });
        if (!res.ok) toast.error(res.error);
        else if (myBest === null || score > myBest) {
          toast.success(copy.usstates.newBest(score));
        }
      })();
    },
    [roomId, myBest],
  );

  // Countdown.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // React to time running out (kept out of the interval to avoid stale closures).
  useEffect(() => {
    if (status === "running" && secondsLeft === 0) endGame(found.size);
  }, [status, secondsLeft, found.size, endGame]);

  function startGame() {
    endedRef.current = false;
    setFound(new Set());
    setValue("");
    setSecondsLeft(USSTATES_DURATION_SECONDS);
    setStatus("running");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onChange(next: string) {
    setValue(next);
    if (status !== "running") return;
    const code = matchState(next, found);
    if (!code) return;
    // Correct, fresh state: accept it, clear the box, award the coin.
    const nextFound = new Set(found);
    nextFound.add(code);
    setFound(nextFound);
    setValue("");
    void claimStateCoin({ roomId, code }).then((res) => {
      if (res.ok) {
        setBalance(res.balance);
        if (res.awarded) toast.success(copy.usstates.coinAwarded);
      }
    });
    if (nextFound.size === USSTATES_TOTAL) endGame(USSTATES_TOTAL);
  }

  const missed = US_STATES.filter((s) => !found.has(s.code));

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums">
          {copy.usstates.found(found.size, USSTATES_TOTAL)}
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.usstates.timeLeft(mmss(secondsLeft))}
        </span>
        <span className="font-mono tabular-nums text-amber-500">
          {copy.usstates.balance(balance)}
        </span>
      </div>

      {/* Input / start */}
      {status === "running" ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={copy.usstates.placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={copy.usstates.placeholder}
          />
          <Button variant="outline" onClick={() => endGame(found.size)}>
            {copy.usstates.giveUp}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {copy.usstates.instructions}
          </p>
          <p className="text-xs text-amber-500">{copy.usstates.coinHint}</p>
          <Button onClick={startGame}>
            {status === "ended" ? copy.usstates.playAgain : copy.usstates.start}
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl border bg-muted/10 p-2">
        <UsStatesMap found={found} revealed={status === "ended"} />
      </div>

      {/* End summary */}
      {status === "ended" && (
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
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (Watch for the `react-hooks/exhaustive-deps` rule — the dependency arrays above are already complete.)

- [ ] **Step 3: Commit**

```bash
git add src/components/games/usstates/usstates-game.tsx
git commit -m "feat(usstates): game component (timer, input, scoring)"
```

---

## Task 7: Route page + Games-library card

**Files:**
- Create: `src/app/app/rooms/[id]/games/usstates/page.tsx`
- Modify: `src/app/app/rooms/[id]/games/page.tsx`

- [ ] **Step 1: Create the game page**

Create `src/app/app/rooms/[id]/games/usstates/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UsStatesGame } from "@/components/games/usstates/usstates-game";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getMyBestScore } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface UsStatesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UsStatesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.usstates.title} · ${access.room.name}`
      : copy.usstates.title,
  };
}

export default async function UsStatesPage({ params }: UsStatesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [balance, myBest] = await Promise.all([
    getBibcoins(access.userId),
    getMyBestScore(id, access.userId, "usstates"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.usstates.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.usstates.subtitle}</p>
      </div>
      <UsStatesGame roomId={id} initialBalance={balance} myBest={myBest} />
    </div>
  );
}
```

- [ ] **Step 2: Add the GameCard to the library**

In `src/app/app/rooms/[id]/games/page.tsx`: (a) fetch the best score, and (b) render a card.

(a) Add `getMyBestScore(id, access.userId, "usstates")` to the `Promise.all([...])` and capture it (e.g. as `statesBest`). For example, add this line alongside the other `getMyBestScore` calls and add `statesBest` to the destructured array:

```ts
    getMyBestScore(id, access.userId, "usstates"),
```

(b) Add this card inside the `grid` (next to the other `GameCard`s):

```tsx
        <GameCard
          href={`/app/rooms/${id}/games/usstates`}
          title={copy.usstates.title}
          subtitle={copy.usstates.subtitle}
          emoji="🇺🇸"
          myBest={statesBest}
          statLabel={copy.usstates.stat}
        />
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/app/rooms/[id]/games/usstates/page.tsx" "src/app/app/rooms/[id]/games/page.tsx"
git commit -m "feat(usstates): route page + Games-library card"
```

---

## Task 8: Full verification (REQUIRED SUB-SKILL: superpowers:verification-before-completion)

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all suites pass, including `usstates-match` and `usstates-map`.

- [ ] **Step 2: Type-check + lint clean**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `pnpm dev`, open a room → **Games** → **USA Staten**. Verify with evidence (note each):
  1. Blank map renders, all states grey, no labels, counter `0/50`, timer `5:00`.
  2. Press **Start** → timer counts down, input focused.
  3. Type `Texas` → Texas turns green + labelled, box clears, counter `1/50`, an amber balance bump (+10) appears (if the service key is configured locally; otherwise the balance stays flat — that's the graceful no-op).
  4. Type `NY` and `Californa` → no match (no change). Type `California` → matches.
  5. Re-type `Texas` → no double count, no second coin.
  6. Press **Geef op** → missed states reveal in red with names; summary shows `X/50`; reload the page → "Beste score" reflects the run.

- [ ] **Step 4: Confirm the daily coin cap (spot check)**

In the Supabase SQL editor (or via the ledger), confirm a second play **on the same day** does not re-award already-named states: the `bibcoin_transactions` rows for reason `usstates` use `ref_key = usstates:<user>:<code>:<date>` and are unique per state per day.

- [ ] **Step 5: Update the roadmap**

Add a "Done" entry to `todo.md` describing the USA Staten game, then commit:

```bash
git add todo.md
git commit -m "docs(todo): mark USA Staten game done"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** 5-min timer (Task 6 config), 50 states no DC (Task 1 data), strict English matching (Task 1 + tests), green fill + label / postal code for small states (Task 5), +10/state with per-day cap via idempotent ledger (Task 3 + Task 8 step 4), best score in `game_scores` without arcade double-pay (Task 3 step 3), no leaderboard/King (nothing added), library card (Task 7). All covered.
- **External-asset risk** lives only in Task 2 and is gated by the integrity test (must reach 50/50). Everything downstream is deterministic.
- **Type consistency:** `matchState(guess, found)`, `claimStateCoin({roomId, code})`, `UsStatesMap({found, revealed})`, `US_PATHS`/`US_VIEWBOX`, `US_STATES`/`US_STATE_CODES`/`US_STATE_CODE_TUPLE` are used identically across tasks.
```
