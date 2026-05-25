# BibSync — Prompt 2/3: Core Features (Rooms + Proposals + Presence)

> **Hoe te gebruiken:** start verse Claude Code sessie in dezelfde `bibsync/` folder. De foundation uit deel 1 staat er al.
> **Aan het einde:** commit alles, sluit, `/clear` voor deel 3.

---

## ROL & CONTEXT

Je bent een senior full-stack engineer en je werkt verder aan **BibSync**. Deel 1 is af: project scaffold, Supabase clients, complete DB met RLS, auth flow (register/login/logout), en placeholder `/app` pagina staan er.

**Dit is deel 2 van 3.** In dit deel bouw je: rooms (CRUD + join via code), break proposals + stemmen, en presence tracking. **Geen chat nog** — dat is deel 3.

## ORIËNTATIE EERST

Voor je iets schrijft:
1. Lees `README.md`, `package.json`, `src/middleware.ts`, `src/lib/supabase/*`, `src/types/database.ts`, en `supabase/migrations/0001_init.sql`
2. Bekijk de bestaande auth pagina's om de patterns te begrijpen (server actions, Zod, UI-stijl, Nederlandse copy)
3. Print bondig wat je gevonden hebt en welke patterns je gaat hergebruiken

## TECH RECAP

Next.js 15 App Router, TS strict, Tailwind v4 + shadcn/ui, Supabase via `@supabase/ssr` met `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, Zod, date-fns (Europe/Brussels, 24u), sonner toasts, server actions voor mutaties, pnpm.

## FEATURES DEEL 2

### A. Rooms

Routes:
- `/app/rooms` — lijst van mijn rooms (waar ik member van ben), knoppen "Nieuwe room" en "Join via code"
- `/app/rooms/new` — form: naam (required), beschrijving (optioneel) → genereert 6-char `join_code` (uppercase letters+cijfers, exclude verwarrende chars: `0/O/1/I/L`) → redirect naar room
- `/app/rooms/join` — input voor join code → voegt user toe aan `room_members` → redirect naar room
- `/app/rooms/[id]` — room dashboard (zie hieronder)
- `/app/rooms/[id]/settings` — enkel zichtbaar/toegankelijk voor owner: room hernoemen, join code regenereren, member lijst met kick-knoppen, room verwijderen (met confirm dialog)
- `/app` — redirect: als user 0 rooms heeft → `/app/rooms`, anders → laatste bezochte room (sla op in cookie of localStorage, fallback `/app/rooms`)

Header (bij alle `/app/*` routes):
- Logo/naam links
- Room switcher dropdown midden (toont huidige room + lijst van andere rooms + "alle rooms" link)
- Rechts: dark mode toggle, avatar dropdown (profiel, logout)

### B. Room dashboard (`/app/rooms/[id]`)

Layout (mobile-first, split-view op desktop):
- **Mobile:** tabs bovenaan: "Pauzes" | "Wie is er?" | "Chat" (chat-tab toont placeholder "binnenkort beschikbaar")
- **Desktop (lg:):** twee kolommen — proposals links (groot), presence sidebar rechts (smal). Chat-tab/sectie blijft placeholder.

### C. Break proposals + stemmen

**Form** (modal of inline op room page):
- Type select: lunch / dinner / coffee / other
- Datum picker (default vandaag, max +7 dagen)
- Start tijd: **kwartier picker** — twee selects (uur 00-23, minuten 00/15/30/45) of een time-grid component. Kies wat het beste UX is op mobiel.
- Duur select: 15 / 30 / 45 / 60 / 90 / 120 min
- Note: optionele textarea (max ~200 chars)
- Submit via server action met Zod (`proposal_date >= today`, `start_time` op kwartier, `duration_minutes` veelvoud van 15)

**Lijst:**
- Sortering: vandaag bovenaan, dan oplopend op `start_time`, dan toekomstige dagen
- Proposals ouder dan gisteren niet tonen in default view (optionele "toon archief" toggle is nice-to-have, niet verplicht)
- Per proposal card:
  - Type icon + label, datum + tijdvenster (bv. `Vandaag 12:30 – 13:30`)
  - Maker (display_name + kleine avatar)
  - Note indien aanwezig
  - **Stem-knoppen:** 👍 ja / 🤔 misschien / 👎 nee. Toont aantal per categorie + lijst wie wat stemde (avatars/initialen).
  - Eigen vote highlighten
  - Maker ziet "verwijderen" knop met confirm
- Realtime: Supabase Realtime subscriben op `break_proposals` en `votes` voor de huidige `room_id`. Nieuwe inserts/updates/deletes meteen reflecteren.
- **Optimistic update** bij stemmen: UI past direct aan, server action runs in achtergrond, revert bij error met sonner toast.

### D. Presence

**Status badge** (in header of room sidebar):
- Toont huidige status van ingelogde user voor huidige room: `studying 📚` / `break ☕` / `lunch 🍽️` / `away 🚪` / `done 🏠`
- Klik → dropdown met alle opties. Bij selectie van `break` of `lunch`: optioneel veld "terug om HH:MM" (kwartier picker)
- Default bij eerste bezoek aan room: status = `studying`

**"Wie is er?" sidebar:**
- Lijst alle room members met hun huidige status + `back_at` indien gezet
- Sorteer: actief (`studying`, `break`, `lunch`) bovenaan, dan `away`, dan `done`
- Realtime subscribe op `presence` table voor deze room
- Als `updated_at` > 4u oud is: toon "laatst gezien om HH:MM" in plaats van status
- Auto-reset logica: bij elke server-side fetch van presence, als `updated_at` van vandaag voor 04:00 is, behandel als `studying` (geen nightly cron nodig — lazy reset)

## SERVER ACTIONS

Maak alle mutaties als server actions in `src/app/_actions/` (of dichtbij hun feature, jouw keuze maar consistent):
- `createRoom`, `joinRoom`, `leaveRoom`, `kickMember`, `regenerateJoinCode`, `deleteRoom`, `renameRoom`
- `createProposal`, `deleteProposal`, `castVote` (upsert — één vote per user per proposal)
- `setPresence` (upsert in `presence`)

Elke action: Zod parse → Supabase mutate via server client → `revalidatePath` waar nodig → return `{ok: true}` of `{error: string}`.

## REALTIME PATTERN

Maak een herbruikbare hook `useRealtimeRoom(roomId)` of aparte hooks per tabel. Belangrijke punten:
- Subscribe in `useEffect` met cleanup
- Filter op `room_id` server-side via Supabase Realtime filter
- Update local state op INSERT/UPDATE/DELETE events
- Server-rendered initial data is de bron van waarheid bij page load; realtime patcht erop verder

## KWALITEITSEISEN (recap)

Strict TS, Zod overal, server actions, optimistic updates voor stemmen + presence, mobile-first, dark mode, Nederlandse UI, conventional commits, componenten max ~150 regels, empty/loading/error states overal.

## WAT JE NU NIET DOET

- Chat (deel 3)
- Seed script (deel 3)
- Deploy (deel 3)
- Polish-pass (deel 3)

## EERSTE OUTPUT

1. Korte oriëntatie-samenvatting (wat staat er al, welke patterns volg je)
2. Stappenplan deel 2 met checkboxes
3. Voer uit, status na elke feature-blok (rooms → proposals → presence), commit per blok

**Klaar-criterium voor deel 2:** met twee testaccounts kan ik een room maken, joinen via code, een proposal indienen, stemmen op elkaars proposals (en zien dat het realtime updatet in een tweede browser), en mijn status wijzigen die de ander realtime ziet.

Go.
