# BibSync — Prompt 1/3: Foundation (Setup + DB + Auth)

> **Hoe te gebruiken:** open lege folder, run `claude --dangerously-skip-permissions`, plak deze prompt.
> **Aan het einde:** commit alles, sluit Claude Code, doe `/clear` of nieuwe sessie voor Prompt 2.

---

## ROL

Je bent een senior full-stack engineer. Je bouwt **BibSync**: een groeps-coördinatie web app voor studenten die samen in de bib studeren en pauzes willen synchroniseren. Je werkt **volledig autonoom** — plan, beslis, implementeer, test, fix. Vraag enkel input bij niet-omkeerbare keuzes.

**Dit is deel 1 van 3.** In dit deel bouw je: project scaffolding, Supabase setup, complete database, en volledig werkende auth. Geen feature-pagina's nog. Aan het einde moet ik kunnen registreren, inloggen en op een lege `/app` placeholder pagina landen.

## TECH STACK (vastgelegd)

- Next.js 15 (App Router, TypeScript, Server Actions)
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + RLS + Realtime + Auth)
- Zod, date-fns, sonner, lucide-react
- `@supabase/ssr` voor auth
- pnpm, Node 20+

## SUPABASE KEYS — REEDS KLAARGEZET

`.env.local` bestaat al in de project root met:
```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Gebruik de **nieuwe Supabase API key naming** (`sb_publishable_*`), NIET de legacy anon key naming. De publishable key is een drop-in vervanging voor de anon key in `createBrowserClient` en `createServerClient` van `@supabase/ssr`. Gebruik dus `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` overal.

## DATAMODEL — VOLLEDIG (alles in deel 1 maken)

Maak één SQL migration file `supabase/migrations/0001_init.sql` met **alle** tabellen, RLS policies, triggers en indexes. Niet opsplitsen per feature — alles in één keer.

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
  start_time time NOT NULL,
  duration_minutes int NOT NULL,
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

**RLS policies (cruciaal):**
- User ziet enkel rooms waar hij member van is
- User ziet enkel proposals/votes/messages/presence van zijn rooms
- User kan enkel inserten/voten/messagen namens zichzelf
- Enkel owner kan room verwijderen of members kicken
- Enkel maker kan zijn proposal verwijderen
- Profile readable voor iedereen, enkel eigenaar mag updaten

**Trigger:** automatische `profile` aanmaak bij nieuwe `auth.users` (met `display_name` uit metadata, fallback op email-prefix).

**Indexes:** `messages(room_id, created_at desc)`, `break_proposals(room_id, proposal_date desc)`, `votes(proposal_id)`, `room_members(user_id)`.

## STAPPENPLAN DEEL 1

1. **Plan & init**
   - Print bondig plan met checkboxes
   - `pnpm create next-app@latest bibsync --typescript --tailwind --app --src-dir --import-alias "@/*"` (of `.` indien al in folder)
   - Init git, eerste commit
2. **Dependencies:** `@supabase/supabase-js @supabase/ssr zod date-fns sonner lucide-react clsx tailwind-merge`
3. **shadcn/ui setup:** init + installeer `button input card dialog tabs badge avatar dropdown-menu skeleton label textarea select sonner`
4. **Env:** maak `.env.local.example` (lege values), zet `.env.local` in `.gitignore` (check of het al in Next.js default zit)
5. **Supabase clients:** maak `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts` via `@supabase/ssr`
6. **Database migration:** schrijf de volledige SQL in `supabase/migrations/0001_init.sql`. Geef mij aan het einde exacte instructies om dit te runnen via Supabase SQL Editor (copy-paste flow). Test na het runnen NIET vanuit code — ik verifieer manueel in Supabase Table Editor.
7. **TypeScript types:** maak `src/types/database.ts` met types die matchen met het schema (handmatig, niet via CLI generation — sneller voor v1)
8. **Auth flow:**
   - `/login` — email + wachtwoord + magic link tab
   - `/register` — email + wachtwoord + display_name
   - `/app/profile` — toont email, display_name, logout knop (verder leeg)
   - `/app` — placeholder pagina "Welkom {display_name}, hier komen je rooms"
   - `/` — landing met CTA naar /login en /register
   - Middleware (`src/middleware.ts`) beschermt alle `/app/*` routes
9. **Basic layout:** root layout met dark mode (next-themes), sonner toaster, Tailwind base styling
10. **README.md:** setup instructies (env, Supabase project, migration runnen, `pnpm dev`)

## KWALITEITSEISEN

- Strikt TypeScript (`strict: true`, geen `any`)
- Server Actions voor alle auth mutaties met Zod validatie
- UI-tekst in Nederlands, code/commentaren in Engels
- Centraliseer UI-strings in `src/lib/copy.ts`
- Componenten max ~150 regels
- Conventional commits per logische stap (`feat:`, `chore:`, `fix:`)
- Modern clean design (Linear/Vercel-stijl), mobile-first, touch targets ≥ 44px
- 24u tijd notatie, Europe/Brussels timezone (zet `TZ` en date-fns formatters al klaar)

## WAT JE NU NIET DOET (komt in deel 2/3)

- Rooms maken/joinen/managen
- Break proposals + stemmen
- Presence tracking
- Chat
- Realtime subscriptions
- Deploy

## EERSTE OUTPUT

1. Bondig stappenplan met checkboxes
2. Eerste batch commands
3. Voer uit, status na elke grote stap, stop enkel als je tegen iets onverwacht aanloopt

**Klaar-criterium voor deel 1:** ik kan `pnpm dev` runnen, registreren, inloggen, op `/app` landen, en uitloggen. De `profiles` rij is automatisch aangemaakt in Supabase bij registratie. Alle DB tabellen + RLS bestaan al (klaar voor deel 2/3).

Go.
