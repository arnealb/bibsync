# USA Staten — kaartquiz (design)

_2026-06-02_

## Wat

Een nieuw spel in de Games-bibliotheek: **"USA Staten"** — een Sporcle-achtige
kaartquiz. Je ziet een blanco kaart van de Verenigde Staten (alle 50 staten,
zonder namen). Bovenaan staat één invoerveld. Je typt staatsnamen; zodra je een
nog niet geraden staat correct typt, kleurt die staat **groen**, verschijnt de
naam op de kaart en wist het veld zich voor de volgende gok. Een klok van **5
minuten** telt af; daarna (of als je opgeeft / alle 50 hebt) worden de gemiste
staten onthuld en is je eindscore bekend.

Dutch UI, conform de rest van de app.

## Beslissingen (vastgelegd met de gebruiker)

- **Spelmodus:** aftellende timer van **5:00**. Score = aantal correct geraden
  staten bij het einde.
- **Aantal:** **50 staten** (Washington D.C. doet *niet* mee). Score is `X/50`.
- **Taal:** **alleen Engels**. De canonieke Engelse naam telt; de kaart toont de
  Engelse naam.
- **Herkenning:** **strikt**. Niet-hoofdlettergevoelig, trim, dubbele spaties
  samenvouwen. Géén afkortingen, géén typfout-tolerantie. `new york` ✓,
  `NY` / `newyork` / `Californa` ✗.
- **Coins:** **+10 per geraden staat**, met een cap van **10 coins per staat per
  dag**. Afgedwongen via de idempotente bibcoin-ledger: award-sleutel bevat de
  staatscode én de dag (Brussel), dus elke staat betaalt één keer per dag uit
  (max 500/dag voor alle 50) en de volgende dag opnieuw.
- **Persistentie:** persoonlijke beste score wordt bewaard (hergebruik van
  `game_scores`, key `"usstates"`). **Geen** per-room leaderboard, **geen** King.
- **Mini-staatjes:** op de te kleine noordoostelijke staatjes (RI, DE, CT, NJ,
  NH, VT, MA, MD) verschijnt de **postcode** i.p.v. de volledige naam; de
  volledige namen staan in een compacte "gevonden"-lijst bij de kaart. De kaart
  blijft het hoofdbeeld (Sporcle-stijl).
- **Algemene look & feel:** zo dicht mogelijk bij Sporcle.

## Aanpak: statische inline SVG

De kaart is één **statische, publiek-domein SVG** (een blanco AlbersUSA-kaart)
met per staat een `<path id="<postcode>" …>`. Invullen = `fill` aanpassen; de
naam is een `<text>` op een vast label-ankerpunt per staat. Geen nieuwe
dependency, volledig offline, volle controle over kleuren en labels — past bij de
bestaande "pure, geteste engine in `src/lib/<game>/`"-stijl.

> Overwogen alternatieven: **Leaflet + GeoJSON** (al aanwezig voor geofencing,
> maar tegels/pan-zoom voelen zwaar voor een quiz — afgewezen) en
> **`react-simple-maps`** (kant-en-klaar, maar voegt d3 + topojson toe —
> afgewezen wegens onnodige dependencies).

**Enige externe asset:** de SVG-pathdata wordt één keer binnengehaald uit een
publiek-domein bron (bv. Wikimedia "Blank US Map (states only)" of de
publiek-domein `us-atlas`) en als statische data in de repo opgenomen, met een
`id` per staat. Label-ankerpunten (centroïdes) worden afgeleid/vastgelegd per
staat. Dit is de enige stap met een licentie-check (moet publiek domein zijn).

## Architectuur & bestanden

Server haalt de begintoestand op; de client speelt het spel en muteert. Coins
zijn server-authoritative; de score-insert volgt het bestaande patroon.

### Pure logica + data — `src/lib/usstates/`

- `states.ts` — de 50 staten: `{ code (postcode), name (Engels), small?: boolean }`.
  `small` markeert de mini-staatjes die hun postcode tonen i.p.v. de naam.
- `match.ts` — `normalizeGuess(s)` (lowercase + trim + spaties samenvouwen) en
  `matchState(guess, found): code | null` (strikt; geeft `null` bij geen match
  of reeds gevonden).
- `map.ts` — de SVG-data: `viewBox`, per staat `{ code, d (path), label: {x, y} }`.
- **Tests** (`match.test.ts`, `states.test.ts`): strikte matching (accepteert
  canonieke naam case-insensitive, verwerpt afkorting/typfout, vouwt witruimte,
  telt niet dubbel); en data-integriteit (exact 50 unieke codes/namen; elke
  staat in `states.ts` heeft een path én label-anker in `map.ts`, en omgekeerd).

### Server actions — `src/app/_actions/usstates.ts`

- `claimStateCoin(roomId, code)` → `requireRoomAccess`, valideer `code` ∈ de 50
  postcodes (zod), dan
  `awardBibcoins(userId, 10, "usstates", \`usstates:${userId}:${code}:${todayInBrussels()}\`)`.
  Retourneert `{ ok, balance, awarded }` (`awarded=false` als die staat vandaag
  al betaald was). De idempotente ledger dwingt de dag-cap af; zelfs herhaald
  aanroepen levert nooit meer dan 10/staat/dag op.

### Score-insert (hergebruik)

- Voeg `"usstates"` toe aan `GAME_KEYS` in `src/lib/validation/games.ts`.
- In `submitGameScore` (`_actions/games.ts`): voor key `"usstates"` **geen**
  `earnFromArcade` aanroepen (coins komen al per staat binnen). Eén kleine branch:
  `petconnect → earnFromPetConnect; else if key !== "usstates" → earnFromArcade`.
- Validatie: nieuwe `claimStateCoinSchema` (`roomId` uuid, `code` enum van de 50
  postcodes) in `src/lib/validation/`.

### UI — `src/components/games/usstates/`

- `usstates-map.tsx` — presentational SVG. Props: `found: Set<code>`,
  `revealed: boolean`. Rendert per staat: neutraal (niet gevonden), groen +
  label (gevonden), of rood + label (na onthulling). ≤~150 r.
- `usstates-game.tsx` — `"use client"` staat-machine (`idle | running | ended`):
  timer, invoer-afhandeling, teller `X/50`, coin-balans + "+10"-feedback,
  Start / Stoppen(Geef op) / Speel-opnieuw, en de score-submit bij het einde.
  Houdt handlers in een ref (geen mutatie tijdens render).

### Route & navigatie

- `src/app/app/rooms/[id]/games/usstates/page.tsx` — server component:
  `requireRoomAccess`, `getBibcoins`, `getMyBestScore(id, userId, "usstates")`;
  rendert `<UsStatesGame roomId initialBalance myBest />`. `generateMetadata`
  zoals de andere game-pagina's.
- Een `GameCard` op `…/games/page.tsx` (emoji 🇺🇸, `myBest` = beste `X/50`).
- Dutch copy onder `copy.usstates` in `src/lib/copy.ts` (titel, subtitle,
  uitleg, knoppen, einde-tekst). Geen hardcoded strings in componenten.

## Dataflow

1. Pagina laadt → toont uitleg, beste score, "Start".
2. Start → timer 5:00 loopt, veld krijgt focus.
3. Toets → client normaliseert + `matchState` (de lijst is geen geheim, dus
   directe client-validatie voor instant feedback). Bij verse match: optimistisch
   groen + label + teller +1 + veld leeg; en `claimStateCoin` op de achtergrond
   → balans bijwerken + "+10" tonen als `awarded`.
4. Einde (timer 0 | 50/50 | Stoppen) → onthul gemiste staten (rood + naam),
   toon eindscore, `submitGameScore({ gameKey: "usstates", score })` → beste
   score bewaard/bijgewerkt. "Speel opnieuw" reset de toestand.

## Veiligheid / misbruik

- Coins: de award-sleutel `usstates:<user>:<code>:<dag>` maakt elke staat
  idempotent per dag → max 10/staat/dag, max 500/dag, onafhankelijk van hoe vaak
  de client aanroept. Geen +EV-exploit mogelijk (vast bedrag, harde dag-cap).
- Beste score: client stuurt `score` (≤50) net als de andere arcade-games; een
  vervalste 50 is betekenisloos (er is geen leaderboard/beloning aan gekoppeld).

## Niet in scope (YAGNI)

- Geen leaderboard, geen King/cron, geen "cheated"-vlag.
- Geen Washington D.C., geen territoria.
- Geen moeilijkheidsgraden, hints of regio-modi.
- Geen Nederlandse spelling van staatsnamen.

## Open punt voor review

De mini-staat-weergave (postcode op het staatje + compacte namenlijst) wijkt licht
af van Sporcle's "naam-met-lijntje-in-de-oceaan". Dit is bewust gekozen voor
leesbaarheid en eenvoud, en is later triviaal aan te passen.
