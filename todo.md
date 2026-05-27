# BibSync — TODO / roadmap

Working order: finish the item marked **in progress**, then take the next
unchecked item top-to-bottom.

## Done

- [x] **Testsuite** — Vitest unit tests (`averageTime`, slot-passed, vote-weight,
      presence-reset, gif-detectie, join-code, tijd-helpers, message-grouping)
      via `pnpm test`, + Playwright smoke-e2e voor de publieke routes + auth-gate
      via `pnpm test:e2e`. Diepere authed flows vragen een test-omgeving met
      seed-accounts.
- [x] **"Winnaar"-badge** — meest-gestemde optie per slot + per dag-groep krijgt
      een groene "🏆 Beslist"-badge (`pickWinnerId`, gewogen met de joke-stem).
- [x] **Aparte chatpagina + games-pagina per kamer** — chat op
      `/app/rooms/[id]/chat`, sub-tabs (Overzicht/Chat/Eten/Games), Snake als
      eerste spel met per-kamer leaderboard (`game_scores` tabel + RLS).
- [x] **GIF's in de chat** — Giphy-zoeker, GIF-berichten renderen als afbeelding.
- [x] **Emoji-reacties op chatberichten** (👍❤️😂🎉👎🔥) — togglebare reacties,
      realtime gesynct, `message_reactions` tabel + RLS.
- [x] **Instant break ("Pauze nu")** — 2 mensen die binnen 90s drukken forceren
      meteen pauze voor de hele room, met realtime banner + aftelling.
      Duur instelbaar. `instant_break_pushes` / `instant_breaks` + RLS.
- [x] **Poker (Texas Hold'em)** — volwaardige multiplayer in de Games-bibliotheek
      (`/games/poker`): blinds, inzetrondes, side pots, showdown met
      hand-evaluator. Server-authoritative via service-role + hole-card RLS.
      Pure, geteste engine (poker-evaluate/-engine tests).
- [x] **Realtime-fix** — gedeelde browser-client met JWT op de realtime-socket,
      zodat RLS-changes (chat/poker/presence) binnenkomen zonder refresh.

## Now

- [ ] **Stappen-feature afwerken (Apple Health)** — gebouwd & live: dagtotaal
      vergelijken i.p.v. scherm openhouden (`step_sessions`, health=max /
      browser=som, geen dubbeltelling), per-room ranglijst (realtime),
      bibcoins per 1000 stappen + achievements, browser-teller als fallback,
      `POST /api/steps` met één-plak **koppelcode** (`token~roomId`), en de
      knoppen "Kopieer koppelcode" + "Voeg toe aan Shortcuts" op de
      **Stappen**-tab. **Te checken (morgen):**
      (a) shortcut 1× bouwen op iPhone (Vind Gezondheidsmonsters → Som →
      `POST /api/steps` met `code`+`steps`) met een **importvraag** voor de
      koppelcode; (b) iCloud-link delen → in Vercel `NEXT_PUBLIC_SHORTCUT_URL`
      zetten (of de link naar mij sturen) zodat de één-tik-knop verschijnt;
      (c) end-to-end testen: code plakken → dagtotaal springt op de ranglijst.
      Migratie `0024_step_sessions.sql` is al uitgevoerd.
- [ ] **Snake-polish (post-MVP)** — (a) `getRoomLeaderboard` server-side
      aggregeren (RPC of view) i.p.v. alle rijen ophalen, (b) bij eindscore = 0
      een korte info-toast i.p.v. stille no-op, (c) `myBest` na elke succesvolle
      submit lokaal bijwerken zodat "Nieuwe high score" niet ten onrechte
      triggert binnen één sessie.
- [ ] **Chatbericht bewerken/verwijderen** — nu ontbreekt edit (en delete).
- [ ] **@mentions in chat** → push naar de genoemde persoon.
- [ ] **Online-indicator + "aan het typen…"** via Supabase Realtime presence.

## Backlog (ideas, unprioritised)

- Poker-leaderboard / fiches-ranglijst per room (wie staat het rijkst?).
- Meer spellen in de Games-bibliotheek.
- Dagoverzicht bovenaan de room (geaggregeerde uitkomst in één kaartje).
- Aanwezigheid per moment (RSVP: ik kom / kom niet, headcount).
- Eigen slot-defaults per room (owner stelt tijden/labels in).
- Per-room meldingen dempen + stille uren.
- Locatie bij presence ("3e verdieping").
- Agenda-export (.ics) / Google/Apple sync.
- Statistieken & streaks.
- Generieke polls.
- i18n (Engels naast Nederlands).
- Thema-kiezer (meer easter-egg-thema's), confetti bij consensus.
- Meer chat-commando's (`/me`, `/shrug`, `/flip`).
