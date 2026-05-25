# BibSync — TODO / roadmap

Working order: finish the item marked **in progress**, then take the next
unchecked item top-to-bottom.

## Done

- [x] **Testsuite** — 26 Vitest unit tests (`averageTime`, slot-passed,
      vote-weight, presence-reset, gif-detectie, join-code, tijd-helpers,
      message-grouping) via `pnpm test`, + Playwright smoke-e2e voor de publieke
      routes + auth-gate via `pnpm test:e2e`. Diepere authed flows vragen een
      test-omgeving met seed-accounts.
- [x] **"Winnaar"-badge** — meest-gestemde optie per slot + per dag-groep krijgt
      een groene "🏆 Beslist"-badge (`pickWinnerId`, gewogen met de joke-stem).

## Now

- [ ] **Emoji-reacties op chatberichten** (👍❤️😂) — los van de gewone reacties,
      lichtgewicht.
- [ ] **Chatbericht bewerken/verwijderen** — nu ontbreekt edit (en delete).
- [ ] **@mentions in chat** → push naar de genoemde persoon.
- [ ] **Online-indicator + "aan het typen…"** via Supabase Realtime presence.

## Backlog (ideas, unprioritised)

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
