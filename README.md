# BibSync

Groeps-coördinatie web app voor studenten die samen in de bib studeren. Plan
pauzes, stem op voorstellen en zie wie er aan het studeren is. Dit is **deel 1
van 3** (foundation): project setup, database en authenticatie. Rooms,
proposals, presence en chat volgen in deel 2 en 3.

## Stack

- **Next.js 16** (App Router, TypeScript strict, Server Actions)
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (Postgres + Row Level Security + Realtime + Auth) via `@supabase/ssr`
- Zod, date-fns (Europe/Brussels, 24u), sonner, lucide-react, next-themes
- **pnpm**, Node 20+

## Setup

### 1. Dependencies

```bash
pnpm install
```

> **Node 21?** pnpm 11 (de huidige `@latest`) vereist Node 22+. Op Node 20/21
> werk je met pnpm 9: `npm install -g pnpm@9`.

### 2. Supabase project

1. Maak een project aan op [supabase.com](https://supabase.com).
2. Ga naar **Project Settings → API keys** en kopieer:
   - de **Project URL**
   - de **publishable key** (nieuwe naming, begint met `sb_publishable_…`)

### 3. Database migration

Open in het Supabase dashboard de **SQL Editor**, plak de volledige inhoud van
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) en klik
**Run**. Dit maakt alle tabellen, RLS-policies, de profiel-trigger, indexes en
realtime-publicatie aan in één keer.

> Verifieer daarna in de **Table Editor** dat de tabellen (`profiles`, `rooms`,
> `room_members`, `break_proposals`, `votes`, `presence`, `messages`) bestaan.

### 4. Environment variables

Kopieer het voorbeeld en vul je waarden in:

```bash
cp .env.local.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<jouw-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> **Nieuwe key naming:** BibSync gebruikt de nieuwe Supabase API keys
> (`sb_publishable_*`), niet de legacy `anon` key. De publishable key is een
> drop-in vervanging in `createBrowserClient` / `createServerClient`.

### 5. Auth-instellingen (aanbevolen voor lokaal testen)

In **Authentication → URL Configuration**: zet **Site URL** op
`http://localhost:3000` zodat magic links en bevestigingsmails lokaal werken.

Wil je tijdens het ontwikkelen meteen na registratie inloggen, zet dan
**Authentication → Sign In / Providers → Email → Confirm email** tijdelijk uit.
Met bevestiging aan krijg je een mail; de link landt op `/auth/confirm` en logt
je daarna in.

### 6. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Wat werkt in deel 1

- Landing (`/`) met CTA's naar inloggen en registreren
- Registreren (`/register`) met weergavenaam, e-mail en wachtwoord
- Inloggen (`/login`) met wachtwoord óf magic link
- Beschermde app: `/app` (placeholder) en `/app/profile` (met uitloggen)
- `/app/*` is afgeschermd door de proxy (voorheen middleware); niet-ingelogde
  bezoekers gaan naar `/login`
- Bij registratie wordt automatisch een `profiles`-rij aangemaakt (DB-trigger)

## Scripts

| Commando      | Beschrijving                |
| ------------- | --------------------------- |
| `pnpm dev`    | Start de dev-server         |
| `pnpm build`  | Productie-build             |
| `pnpm start`  | Start de productie-build    |
| `pnpm lint`   | ESLint                      |

## Projectstructuur

```
src/
  app/
    (auth)/login, (auth)/register   # auth-pagina's (route group)
    app/                            # beschermde app (layout + profile)
    auth/confirm/route.ts           # email-/magic-link-callback
    _actions/auth.ts                # server actions (Zod + Supabase)
  components/
    auth/                           # formulieren + logout
    ui/                             # shadcn/ui componenten
  lib/
    supabase/{client,server,middleware}.ts
    auth.ts, copy.ts, time.ts, url.ts, env.ts, validation/
  types/database.ts                 # handgeschreven DB-types
supabase/migrations/0001_init.sql   # volledig schema + RLS + trigger
src/proxy.ts                        # sessie-refresh + route-bescherming
```
