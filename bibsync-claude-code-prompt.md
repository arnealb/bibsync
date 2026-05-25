# Claude Code Prompt — BibSync

> **Hoe te gebruiken:** open een lege folder, run `claude --dangerously-skip-permissions`, plak onderstaande prompt. Claude Code zal autonoom plannen, scaffolden, coderen en je begeleiden bij deploy.

---

## ROL

Je bent een senior full-stack engineer. Je bouwt **BibSync**: een groeps-coördinatie web app voor studenten die samen studeren in de bib en willen synchroniseren rond pauzes, middageten en avondeten. Je werkt **volledig autonoom** — plan, beslis, implementeer, test, fix. Vraag enkel om input wanneer een keuze niet-omkeerbaar is (bv. Supabase project URL, deploy).

## DOEL

Een production-ready web app waar een groep vrienden in een "room" kan inloggen, tijdslotten van 15 min kan voorstellen voor pauzes, daarop kan stemmen, zijn aanwezigheidsstatus kan zetten, en in realtime kan chatten.

## TECH STACK (vastgelegd, niet onderhandelen)

- **Framework:** Next.js 15 (App Router, TypeScript, Server Actions)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Database + Auth + Realtime:** Supabase (Postgres + Row Level Security + Realtime channels)
- **Validatie:** Zod
- **State:** React Server Components waar mogelijk, `@supabase/ssr` voor auth, `useOptimistic` voor snelle UI
- **Datum/tijd:** `date-fns` (Europe/Brussels timezone, 24u formaat, week start = maandag)
- **Deploy:** Vercel
- **Package manager:** pnpm
- **Node:** 20+

## FEATURES (v1 scope — alles bouwen)

### 1. Auth
- Email + wachtwoord registratie en login via Supabase Auth
- Magic link als fallback
- Profiel: `display_name`, `avatar_url` (optioneel)
- Logout
- Protected routes via middleware

### 2. Rooms (groepen / bib-sessies)
- User kan een room aanmaken (naam + optionele beschrijving)
- Genereert een **6-karakter join code** (bv. `BIB-X7K2`)
- Andere users joinen via join code → worden member
- Room owner kan members kicken
- User kan meerdere rooms hebben, switcher in header
- Room dashboard = home view na login

### 3. Pauze-voorstellen + stemmen
- Binnen een room kan elke member een **pauze-voorstel** aanmaken:
  - Type: `lunch` | `dinner` | `coffee` | `other`
  - Tijdslot: start tijd in **kwartieren** (00, 15, 30, 45)
  - Duur in kwartieren (15min, 30min, 45min, 60min, 90min, 120min)
  - Datum (default: vandaag)
  - Optionele notitie (bv. "Simon Says of Charlatan?")
- Andere members kunnen stemmen: 👍 (ja) / 🤔 (misschien) / 👎 (nee)
- Stemmen zijn zichtbaar voor iedereen (wie stemde wat)
- Auto-sortering: voorstellen voor vandaag bovenaan, gesorteerd op start tijd
- Voorstellen ouder dan gisteren worden gearchiveerd (niet zichtbaar in default view)
- Maker kan zijn eigen voorstel verwijderen
- Realtime: nieuwe stemmen en voorstellen verschijnen meteen voor alle members

### 4. Aanwezigheidsstatus
- Per user per room: status badge
  - `studying` 📚 (default als ingelogd in room)
  - `break` ☕
  - `lunch` 🍽️
  - `away` 🚪
  - `done` 🏠 (gaat naar huis / klaar voor vandaag)
- Eén klik om te wisselen, met optionele "terug om HH:MM"
- Realtime zichtbaar in een "Wie is er nu" sidebar
- Auto-reset naar `studying` om 04:00 elke nacht (via Postgres scheduled function of last_seen logic)
- Toon `last_seen` als status > 4u oud is

### 5. Realtime chat per room
- Eenvoudige chat: tekst messages, timestamp, author
- Supabase Realtime channel per room
- Optimistic UI bij verzenden
- Scroll-to-bottom bij nieuwe message, behalve als user gescrolld is (dan badge "X nieuwe berichten")
- Geen edit/delete in v1 — keep it simple
- Geen file uploads in v1

## DATAMODEL (Supabase / Postgres)

Maak deze tabellen met expliciete RLS policies. Schrijf alles in **één SQL migration file** in `supabase/migrations/`.

```sql
-- profiles (1-op-1 met auth.users)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
)

-- rooms
rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  join_code text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
)

-- room_members
room_members (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
)

-- break_proposals
break_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id),
  proposal_type text NOT NULL CHECK (proposal_type IN ('lunch','dinner','coffee','other')),
  proposal_date date NOT NULL,
  start_time time NOT NULL,           -- altijd op kwartier
  duration_minutes int NOT NULL,      -- veelvoud van 15
  note text,
  created_at timestamptz DEFAULT now()
)

-- votes
votes (
  proposal_id uuid REFERENCES break_proposals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('yes','maybe','no')),
  voted_at timestamptz DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
)

-- presence
presence (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('studying','break','lunch','away','done')),
  back_at time,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
)

-- messages
messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now()
)
```

**RLS regels** (cruciaal, niet vergeten):
- Een user kan enkel rooms zien waar hij member van is
- Een user kan enkel proposals/votes/messages/presence van zijn rooms zien
- Een user kan enkel stemmen/messages namens zichzelf inserten
- Enkel de owner kan een room verwijderen of members kicken
- Enkel de maker kan een proposal verwijderen
- Profile mag iedereen lezen (voor display names), maar enkel eigenaar mag updaten

Voeg een Postgres trigger toe die automatisch een `profile` rij aanmaakt bij nieuwe `auth.users`.

Maak indexes op `messages(room_id, created_at desc)`, `break_proposals(room_id, proposal_date desc)`, `votes(proposal_id)`.

## UI / UX RICHTLIJNEN

- **Design:** modern, clean, niet te bedrijfsmatig. Denk Linear / Vercel-stijl: veel whitespace, zachte borders (`rounded-lg`), subtiele schaduwen, dark mode support (toggle in header).
- **Mobiel-first** — studenten checken dit op hun telefoon onder de tafel. Touch targets ≥ 44px.
- **Geen emoji-spam**, maar gebruik ze functioneel voor status (📚☕🍽️🚪🏠) en stem-acties (👍🤔👎)
- **Empty states:** als een room geen proposals heeft, toon vriendelijke prompt "Nog geen pauzes voorgesteld — stel er een voor 👇"
- **Loading states:** skeletons, geen spinners
- **Error states:** inline toast (gebruik `sonner`)
- **Timezone:** alles in Europe/Brussels, 24-uurs notatie (`17:45`, niet `5:45 PM`)
- **Taal:** Nederlands voor alle UI-tekst. Code en commentaren in Engels.

## ROUTING

```
/                       → landing (CTA: log in / register)
/login                  → email+wachtwoord + magic link
/register               → registratie
/app                    → redirect naar laatste room of /app/rooms
/app/rooms              → lijst van mijn rooms + "nieuwe room" + "join via code"
/app/rooms/new          → room creëren
/app/rooms/join         → join via code
/app/rooms/[id]         → room dashboard (proposals + presence + chat in tabs of split-view)
/app/rooms/[id]/settings → enkel voor owner
/app/profile            → display name, avatar, logout
```

## STAPPENPLAN (volg deze volgorde, vink af in je antwoord)

1. **Plan & init**
   - Print bondige executable plan met checkboxes
   - `pnpm create next-app@latest bibsync --typescript --tailwind --app --src-dir --import-alias "@/*"`
   - Init git, eerste commit
2. **Dependencies:** `@supabase/supabase-js @supabase/ssr zod date-fns sonner lucide-react clsx tailwind-merge`
3. **shadcn/ui setup:** init + installeer button, input, card, dialog, tabs, badge, avatar, dropdown-menu, toast, skeleton, label, textarea, select
4. **Env setup:** `.env.local.example` met `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Vraag mij om de echte values wanneer je klaar bent om te testen.
5. **Supabase client:** server + browser + middleware helpers via `@supabase/ssr`
6. **Database migration:** schrijf de SQL in `supabase/migrations/0001_init.sql` met **alle tabellen + RLS + triggers + indexes**. Geef mij instructies om dit via Supabase SQL editor of CLI te runnen.
7. **TypeScript types:** genereer types matchend met DB schema in `src/types/database.ts`
8. **Auth flow:** register, login, magic link, logout, middleware bescherming
9. **Rooms:** lijst, create, join via code, switcher in header
10. **Presence:** badge + dropdown om status te wisselen, sidebar met live status van members
11. **Break proposals:** form (datum picker, kwartier slot picker, type, duur, note), lijst gesorteerd, vote knoppen, realtime updates
12. **Chat:** realtime channel, optimistic send, scroll-management
13. **Polish:** dark mode toggle, mobile layout testen, loading & error states, leeg-states, 404
14. **Seed script:** `scripts/seed.ts` die een test-room met 3 fake users en wat data maakt (optioneel maar nice)
15. **README.md:** setup-instructies, env vars, Supabase setup steps, hoe deployen naar Vercel
16. **Deploy:** instrueer me hoe ik `vercel deploy` en de Supabase env vars erin krijg

## KWALITEITSEISEN

- Strikte TypeScript (`strict: true`, geen `any`)
- Server Actions voor alle mutaties, met Zod validatie aan beide kanten
- Geen client-side Supabase calls voor data die ook server-side kan
- Geen hard-coded strings die UI-tekst zijn — zet ze in een `src/lib/copy.ts` voor centralisatie
- Componenten max ~150 regels — splitsen indien groter
- Geen `useEffect` voor data fetching tenzij echt nodig (realtime subscriptions zijn de uitzondering)
- Optimistic updates voor stemmen, status wisselen, en chat berichten
- Commit per logische stap met conventional commits (`feat:`, `fix:`, `chore:`)

## WAT JE NIET MOET DOEN

- Geen tests schrijven (v1, time-box)
- Geen i18n framework (enkel NL hardcoded UI)
- Geen push notifications, email notifications
- Geen file uploads, avatars zijn URL-only
- Geen complexe role-based permissions buiten owner/member
- Geen calendar integratie
- Niet over-engineeren — dit is een tool voor ~10 vrienden, niet voor 10k users

## EERSTE OUTPUT VAN JOU

Begin je antwoord met:
1. Het exacte stappenplan met checkboxes
2. De eerste batch commands die je gaat runnen
3. Daarna: voer uit. Geef tussentijdse status na elke grote stap. Stop en vraag mij ENKEL wanneer je Supabase URL/anon key nodig hebt, of voor de deploy.

## SUPABASE KEYS — REEDS KLAARGEZET

Ik heb `.env.local` al aangemaakt met:
  NEXT_PUBLIC_SUPABASE_URL=<...>
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

Gebruik deze nieuwe Supabase API key naming (NIET de legacy anon key naming).
De publishable key is een drop-in vervanging voor de oude anon key in zowel
createBrowserClient als createServerClient van @supabase/ssr.

Werk dus met `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` overal waar
voorbeelden NEXT_PUBLIC_SUPABASE_ANON_KEY tonen. Maak een .env.local.example
met dezelfde keys maar lege values, en vermeld in de README dat dit de
nieuwe Supabase key system is (sb_publishable_*), niet de legacy JWT anon key.

Je hoeft mij dus niet meer te vragen om keys — start direct.

Go.
