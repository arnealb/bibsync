# BibSync — Prompt 3/3: Chat + Polish + Deploy

> **Hoe te gebruiken:** start verse Claude Code sessie in `bibsync/`. Deel 1 en 2 zijn af.
> **Aan het einde:** live op Vercel, README compleet, klaar om te delen met je groep.

---

## ROL & CONTEXT

Je bent een senior full-stack engineer en je sluit **BibSync** af. Deel 1 (foundation + auth) en deel 2 (rooms + proposals + presence) staan. Wat resteert: realtime chat, polish pass, optioneel seed script, en deploy naar Vercel.

## ORIËNTATIE EERST

Voor je iets schrijft:
1. Lees `README.md`, `package.json`, en de bestaande room dashboard pagina (`src/app/app/rooms/[id]/...`) — daar moet chat in geïntegreerd worden
2. Bekijk de bestaande realtime hooks (proposals/votes/presence) zodat je hetzelfde pattern volgt
3. Print bondig welke patterns je herbruikt voor chat

## FEATURES DEEL 3

### A. Realtime chat per room

Plek: chat-tab op mobile, derde panel of toggle op desktop (jouw oordeel — clean UX > strikt aan oude placeholder vasthouden).

**Functionaliteit:**
- Tekst messages, max 2000 chars (al afgedwongen in DB)
- Toont: avatar/initialen, display_name, content, tijdstamp (relatieve tijd <1u, absoluut daarna — gebruik date-fns `formatDistanceToNow` met `nl` locale)
- Groepering: opeenvolgende messages van dezelfde author binnen 5 minuten → compacte weergave (één header, daarna alleen bubbles)
- Input onderaan: textarea met Enter-to-send (Shift+Enter = newline), submit-knop, character counter bij >1800
- Optimistic UI: message verschijnt direct met "verzendt..." indicator, vervangt door echte rij wanneer server bevestigt
- Realtime: Supabase Realtime subscribe op `messages` table met filter `room_id=eq.{roomId}`
- Initial load: laatste 50 messages server-side fetched, oudere via "laad meer" knop bovenaan (paginatie op `created_at`)
- Scroll-gedrag:
  - Bij mount: scroll naar onder
  - Nieuwe message + user is aan de onderkant (binnen ~100px): auto-scroll
  - Nieuwe message + user is omhoog gescrolld: toon "X nieuwe berichten ↓" badge die scrollt bij klik
- Empty state: "Nog geen berichten — zeg hallo 👋"
- Geen edit, geen delete, geen reacties, geen files in v1

### B. Polish pass

Loop door de hele app en fix:
- **Loading states:** elke async data fetch heeft een skeleton (geen spinners)
- **Empty states:** rooms-lijst, proposals-lijst, presence-lijst, chat — alle hebben vriendelijke Nederlandse copy
- **Error states:** sonner toasts bij elke gefaalde server action, met begrijpelijke NL message
- **404 page:** custom `not-found.tsx` met link terug naar `/app`
- **Auth redirect:** ingelogde users die `/login` of `/register` bezoeken → redirect naar `/app`
- **Dark mode:** check elke pagina visueel, fix contrast issues
- **Mobile pass:** doorloop alle routes op een 375px viewport, fix overflow / touch target / readability issues
- **Form UX:** alle forms hebben disabled-state tijdens submit, focus management, error messages onder velden
- **Tijd formatting:** consistent door hele app (24u, Europe/Brussels) — check een paar plekken
- **Toegankelijkheid (basis):** alle iconen-only knoppen hebben `aria-label`, dialogs hebben titles, kleurcontrast voldoende

### C. Seed script (optioneel maar nice)

`scripts/seed.ts` dat met de Supabase admin functionaliteit:
- 3 test users aanmaakt (`alice@bibsync.test`, `bob@...`, `charlie@...` met wachtwoord `test1234`)
- 1 demo room met die 3 als members
- 4 proposals (mix van vandaag/morgen, verschillende types)
- Wat votes en wat presence statuses
- Wat chat messages

Vereist de Supabase **secret/service_role key** — voeg toe aan `.env.local.example` als `SUPABASE_SECRET_KEY` (nieuwe naming). Documenteer in README dat dit enkel voor seeding nodig is, niet voor de app zelf. Als ik geen secret key wil zetten: script skipt netjes met een melding.

Runnable via `pnpm seed` (script in package.json, `tsx scripts/seed.ts`).

### D. README finaliseren

`README.md` moet bevatten:
- Wat BibSync doet (2-3 zinnen)
- Stack
- Setup steps:
  1. Clone, `pnpm install`
  2. Supabase project aanmaken
  3. SQL migration runnen via SQL Editor (copy-paste uit `supabase/migrations/0001_init.sql`)
  4. `.env.local` invullen met `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  5. `pnpm dev`
  6. Optioneel: `pnpm seed`
- Deploy steps (Vercel)
- Notitie over nieuwe Supabase key naming (`sb_publishable_*`)

### E. Deploy naar Vercel

Begeleid mij stap voor stap:
1. Check `pnpm build` lokaal — fix alle errors/warnings
2. Maak `vercel.json` indien nodig (waarschijnlijk niet)
3. Geef me de exacte CLI commands of dashboard-stappen om te deployen
4. Welke env vars in Vercel zetten en hoe
5. Hoe Supabase auth callback URLs te updaten met de Vercel productie URL (Supabase dashboard → Authentication → URL Configuration)
6. Smoke-test checklist na deploy (registreer, login, room maken, proposal, vote, chat)

## KWALITEITSEISEN

- `pnpm build` moet zonder errors of warnings draaien voor deploy
- `pnpm lint` clean
- Geen `console.log` of TODO's in productiecode
- Conventional commits

## EERSTE OUTPUT

1. Korte oriëntatie (welke chat-plek koos je, welk realtime pattern)
2. Stappenplan met checkboxes
3. Voer uit: chat → polish → seed → README → deploy-begeleiding. Commit per blok.

**Klaar-criterium voor deel 3:** BibSync staat live op een `*.vercel.app` URL, ik heb met twee accounts gechat in realtime, alle states (loading/empty/error) zien er goed uit, en de README leidt iemand anders door een schone setup.

Stop en vraag mij enkel: (a) wanneer je klaar bent voor deploy en ik dingen in Vercel/Supabase dashboard moet doen, (b) als `pnpm build` faalt op iets dat input van mij nodig heeft.

Go.
