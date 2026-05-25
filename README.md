# BibSync

Groeps-coördinatie web app voor studenten die samen in de bib studeren. Maak
een room, plan pauzes en stem erop, zie realtime wie er studeert of pauzeert,
en chat met je groep. Alles live via Supabase Realtime.

## Stack

- **Next.js 16** (App Router, TypeScript strict, Server Actions)
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (Postgres + Row Level Security + Realtime + Auth) via `@supabase/ssr`
- Zod, date-fns (Europe/Brussels, 24u), sonner, lucide-react, next-themes
- **pnpm**, Node 20+

## Features

- **Auth** — registreren, inloggen (wachtwoord of magic link), uitloggen
- **Rooms** — aanmaken, joinen via 6-cijferige code, owner-instellingen
  (hernoemen, code vernieuwen, leden kicken, verwijderen)
- **Pauzevoorstellen** — type/datum/kwartier-tijd/duur/notitie, stemmen
  (👍/🤔/👎) met optimistic updates
- **Presence** — status (📚☕🍽️🚪🏠) + "terug om", realtime "Wie is er?"-lijst
- **Chat** — realtime berichten per room, met optimistic verzenden en paginatie
- Dark mode, mobile-first, Nederlandse UI

## Setup

### 1. Dependencies

```bash
pnpm install
```

> **Node 21?** pnpm 11 (`@latest`) vereist Node 22+. Op Node 20/21 werk je met
> pnpm 9: `npm install -g pnpm@9`.

### 2. Supabase project

1. Maak een project aan op [supabase.com](https://supabase.com).
2. Ga naar **Project Settings → API keys** en kopieer:
   - de **Project URL**
   - de **publishable key** (nieuwe naming, begint met `sb_publishable_…`)

### 3. Database migrations

Open in het Supabase dashboard de **SQL Editor** en run beide migrations
(copy-paste, in volgorde):

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
   alle tabellen, RLS-policies, profiel-trigger, indexes en realtime-publicatie.
2. [`supabase/migrations/0002_join_room.sql`](supabase/migrations/0002_join_room.sql)
   — de `join_room`-functie (nodig om via code te joinen).

> Verifieer in de **Table Editor** dat de tabellen bestaan (`profiles`, `rooms`,
> `room_members`, `break_proposals`, `votes`, `presence`, `messages`). Realtime
> staat standaard aan; de migration zet de juiste tabellen al in de publicatie.

### 4. Environment variables

```bash
cp .env.local.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<jouw-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Enkel voor `pnpm seed` — niet voor de app:
SUPABASE_SECRET_KEY=sb_secret_...
```

> **Nieuwe key naming:** BibSync gebruikt de nieuwe Supabase API keys
> (`sb_publishable_*` voor de app, `sb_secret_*` / service_role enkel voor het
> seed-script), niet de legacy `anon` key.

### 5. Auth-instellingen (aanbevolen voor lokaal testen)

- **Authentication → URL Configuration**: **Site URL** = `http://localhost:3000`.
- Voor een vlotte test: **Authentication → Sign In / Providers → Email →
  Confirm email** tijdelijk uit, zodat je meteen na registratie inlogt. Met
  bevestiging aan landt de maillink op `/auth/confirm`.

### 6. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. (Optioneel) demo-data

```bash
pnpm seed
```

Vereist `SUPABASE_SECRET_KEY` in `.env.local`. Maakt 3 testgebruikers
(`alice@bibsync.test`, `bob@…`, `charlie@…`, wachtwoord `test1234`) aan met een
demo-room (join code `DEMO42`), voorstellen, stemmen, presence en berichten.
Zonder secret key stopt het script netjes met een melding.

## Deploy naar Vercel

1. `pnpm build` lokaal — moet zonder errors/warnings draaien.
2. Push naar GitHub en importeer de repo op [vercel.com/new](https://vercel.com/new).
3. Zet in Vercel de **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - (`SUPABASE_SECRET_KEY` enkel als je daar wil seeden — meestal niet nodig)
4. Deploy. Noteer de productie-URL (`https://<project>.vercel.app`).
5. Update in Supabase → **Authentication → URL Configuration**:
   - **Site URL** → je Vercel-URL
   - **Redirect URLs** → voeg `https://<project>.vercel.app/**` toe
6. Smoke-test: registreer, login, room maken, joinen (2e account), voorstel +
   stemmen, status wijzigen, chatten — telkens realtime in een tweede venster.

## Scripts

| Commando     | Beschrijving                          |
| ------------ | ------------------------------------- |
| `pnpm dev`   | Start de dev-server                   |
| `pnpm build` | Productie-build                       |
| `pnpm start` | Start de productie-build              |
| `pnpm lint`  | ESLint                                |
| `pnpm seed`  | Vul de database met demo-data         |

## Projectstructuur

```
src/
  app/
    (auth)/login, (auth)/register   # auth-pagina's
    app/rooms/[id]                  # room dashboard (proposals/presence/chat)
    app/rooms/[id]/settings         # owner-instellingen
    _actions/                       # server actions (Zod + Supabase)
    auth/confirm/route.ts           # email-/magic-link-callback
  components/                       # auth, rooms, proposals, presence, chat, ui
  hooks/                            # realtime subscriptions
  lib/
    supabase/{client,server,middleware}.ts
    rooms/ proposals/ presence/ messages/   # queries + helpers
    copy.ts time.ts validation/             # UI-strings, tijd, Zod-schema's
  types/database.ts                 # handgeschreven DB-types
supabase/migrations/                # 0001_init.sql, 0002_join_room.sql
scripts/seed.ts                     # demo-data (pnpm seed)
src/proxy.ts                        # sessie-refresh + route-bescherming
```
