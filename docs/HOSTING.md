# Ayla’s Puzzles — hub + independent game hosts

One thin **hub** at `https://aylas-puzzles.lovable.app` and one independently published **game host**
project per public game. Every package is built from the same Scene Games master source by
`bun scripts/export-host-packages.ts`; the only difference between packages is the committed
`src/host/host.config.json` and which files each package needs.

```text
release service ── GET /api/manifest ──> hub (menu, age, mode, queue, scroll)
                                          │  full-viewport iframe per instance (max 2: active + 1 hidden prepared)
                                          ▼
                     game host  https://<game>.lovable.app/<path>?band=..&s=..&host_session=..&host_nonce=..&host_game=..&host_phase=..
```

## host.config.json

| field | hub | game host |
|---|---|---|
| `role` | `"hub"` | `"game"` |
| `catalogId` | — | dashboard catalog ID (must be one of `src/host/public-games.ts`) |
| `sourceVersion` | source commit | source commit |
| `manifestUrl` | release manifest (plain HTTPS) | same |

The master review project uses `{ "role": "master" }` (every route, same-origin session preview).

## Public games (src/host/public-games.ts)

| gameId | catalogId | path | historically tested bands (information only) | seed param |
|---|---|---|---|---|
| sudoku | v1-sudoku | /play (fixed `t=sudoku`) | 2–6 | s |
| take | v1-take | /play (fixed `t=take`) | 1–3 | s |
| ordering | v1-lineup | /ordering | 2–6 | s |
| radio | v1-cipher | /radio | 3–6 | s |
| seaside | v1-position | /seaside-scoop | 1–2 | (engine deals its own) |
| airship | v1-shapepick | /airship | 1–2 | s |
| robot | v2-robot | /robot | 4–6 | s |
| curiosity | v2-curiosity | /curiosity | 1–5 | (engine deals its own) |
| sofa | v2-sofa | /sofa | 1–6 | seed |
| seating | v2-seating | /seating | 3–6 | seed |
| ticket | **v1-riddle** | /ticket-machine | 4–6 | s |
| money-change | v1-change | /money-change | 3–6 | s |
| trains | v2-trains | /adventures (fixed `game=trains`) | 1–6 | seed |
| water | **v2-waterway** | /adventures (fixed `game=water`) | 1–6 | seed |

The table is generated documentation — `src/host/public-games.ts` is authoritative. Menu bands are the
global IDs 1–6 (ages 3–4 … 9–10, overlapping). A band is parsed unchanged and THEN gated by the catalog
record's current full dashboard age range; fixed tested ranges never impose a second restriction.
Valid global bands 1–6 pass unchanged; no game-range clamping is permitted.

Note: the live catalog feed spells the Ticket record `v1-riddle`. The registry key must use the same ID
as the catalog record.

## Release manifest contract (`GET <manifestUrl>`)

```json
{
  "catalog": { "version": 2, "revision": "…", "records": [ { "id": "v2-robot", "name": "…", "description": "…",
               "minAge": 7, "maxAge": 10, "thumbnail": "v2-robot.jpg", "hidden": false,
               "release": "available", "nextAction": "Done" } ] },
  "registry": { "version": 1, "revision": "…",
                "games": { "v2-robot": { "catalogId": "v2-robot", "gameId": "robot",
                                          "url": "https://robot-host.lovable.app", "releaseId": "<buildId>" } } }
}
```

- `catalog.release === "available"` is authoritative for published games. First activation needs
  workflow `nextAction: "Done"`; later Updating / In Development never withdraws an active release.
  `hidden`, age bounds and explicit production `active=false` still propagate.
- Hub: a card is playable only with `release: "available"` AND a valid registry entry.
- Game host own gate (decided only after this page load's manifest fetch settles, never on the bundled
  snapshot or on the server):
  - **Published origin** (its `*.lovable.app` slug / custom domain): requires `release: "available"` AND its
    own registry entry whose `url` equals this origin. Missing, unregistered, hidden or withdrawn → fail
    closed: embedded frames ask the hub to go Back; standalone pages go to `https://aylas-puzzles.lovable.app/?band=N`.
  - **Private preview / dev QA origin only** (`id-preview[-N]--<uuid>.lovable.app`, `<uuid>.lovableproject.com`,
    localhost): additionally accepts an unregistered record whose `nextAction` is `"Done"`.
  - An approved `available` release stays playable while the workflow says Updating / In Development.
- Bootstrap: publish the host → read public `/api/release` (always readable, before registration) →
  register/activate it in the dashboard → smoke-test public gameplay → it appears in the hub.
- Registry `url` must be a bare public HTTPS origin (no path, port, query, credentials, preview or
  editor hosts). Entries whose key, `catalogId` or `gameId` disagree with `public-games.ts` are dropped.
- Thumbnails: bundled filenames, or exactly
  `https://aylas-game-releases.coatedscarf3.chatgpt.site/thumbnails/<catalogId>/<sha256>.(png|jpg|webp)`.
  Every other chatgpt.site / preview / editor URL is rejected.
- Catalog and registry are replaced together (one atomic revision); a failed fetch keeps the last valid
  manifest, an invalid one is never applied.

## Game host `/api/release`

`GET https://<host>/api/release` (CORS `*`, no-store, no secrets):
`{ protocol, protocolVersion, role, catalogId, gameId, path, minBand, maxBand, sourceVersion, buildId, releaseId }`.
`buildId` is minted per build (vite `define`). Register it as the registry `releaseId`.
The response `releaseId` is an alias of `buildId`; minBand/maxBand are testing information only.

## postMessage protocol v1 (src/host/protocol.ts)

Envelope on every message: `{ protocol: "ayla-host", v: 1, type, session, nonce, gameId }`.

- Parent → child: `init`, `activate`, `pause`, `prepare`.
- Child → parent: `hello`, `ready` (real content ready, bounded), `location` (`href` = same-game relative
  path with known instance fields only; level keys `l`/`lv`/`lvl`/`level` 1–2 (Train uses `level`; Train alone may also send its legacy `location` field, used only when `href` is absent and canonicalized with `game=trains`), legacy 3 normalized to 2), `next` and
  `previous` (TOP arrows: change puzzle type), `back` (Home). Centre New stays inside the game.
- Standalone game hosts send their top arrows to
  `https://aylas-puzzles.lovable.app/session?band=B&mode=all&game=<gameId>&step=next|previous` (`hubStepHref`).
- The hub mints a fresh nonce per iframe; identity + start phase travel in the iframe URL
  (`host_session`, `host_nonce`, `host_game`, `host_phase`).
- Both sides check `event.origin` AND `event.source`, post only to an exact origin (never `*`), and never
  navigate to a URL taken from a message.
- Allowed parents for a game host: `https://aylas-puzzles.lovable.app`, the two exact owner-approved QA
  previews in `QA_PARENT_ORIGINS` (`src/host/origins.ts`: hub QA `id-preview-4--0a7ba2f9-…` and Scene review
  `id-preview-11--f6472ef2-…`), plus exact HTTPS origins in the build-time `VITE_AYLA_DEV_PARENT_ORIGINS`
  (review builds only). No wildcards. Registry host URLs remain production-only.

### Game-specific location fields

`location` hrefs accept only the shared instance fields plus these single-valued extras (everything else,
duplicates, other games' values and any URL-shaped value drop the whole message):

| game | extra fields |
|---|---|
| trains | `game=trains`, `age` 3–10, `deal` digits |
| water | `game=water`, `age` 3–10, `deal` digits, `level` 1 or 2 |

### Directional `next` (water)

`next` may carry `direction: 1 | -1` ONLY from games listed in `supportsTypeNavigation` (currently `water`).
Any other value from those games drops the message; from every other game the field is ignored. The hub
treats `direction: -1` exactly like `previous` and `+1` (or no direction) like `next`, on the same shared
type navigation described under Session behaviour (history/forward with saved locations, version-checked
restores and promotions, one-eligible-game notice). `stepSessionType` (catalog-order step with per-game
seats) remains in session-queue.ts for directional callers but the session shell does not use it.

### Water child bridge requirements (Cloud Hired a Plumber host)

- `host.config.json`: `role: "game"`, `catalogId: "v2-waterway"`; `/api/release` reports `gameId: "water"`, `path: "/adventures"`.
- Serve only `/adventures?game=water`; map hub `band` (1–6) to the engine age itself.
- Use the shared `child-bridge.ts`: answer `init` with `hello`, report real `ready` (bounded), obey
  `activate` / `pause` / `prepare` (silent and inert while hidden), `back` for All games.
- Report `location` hrefs containing only `game=water`, `band`, `age`, `seed`, `deal`, `level` (1|2), `from`
  (never `prepared`, host_* or other keys), so a hub refresh or a step back restores the exact instance.
- Its header Previous / Next call `requestHostNext(-1)` / `requestHostNext(1)` when embedded (never
  navigate to another type itself); New stays inside the game. Standalone behaviour is unchanged.

## Session behaviour (hub)

- Card launch = single mode (starts with that game); Play all starts from the shuffled no-repeat cycle.
- In both, top Next = a DIFFERENT eligible game (forward entry first, else the prepared next game);
  Previous = the last different game from persisted history with its saved location, skipping ineligible
  entries, else the previous eligible type fresh. One eligible game → a notice, never a re-deal.
- Exactly one hidden prepared iframe (always a different game from the current one) once the current
  one reports real `ready`; promotion reuses it only after a bounded CORS/no-store `/api/release` check.
  The public catalogId/gameId must match, and the public version must equal the version captured when
  that frame began loading. An independently republished host replaces only its RESERVED document,
  with a new identity/nonce but the same reserved game and seed; the active puzzle and seen deck stay
  untouched. Wait for fresh child readiness and retry Next. Same version reuses the mounted document.
  Network, identity or release-check failures retain the active puzzle and show a retry, never silently
  promote an unchecked preload. Reservation does not mark a game played until promotion.
- Hidden frames are silent and paused in each game's own audio wrappers (`isHostSuppressed()`); user
  sound settings are never written while hidden.
- Back returns to the menu with the same age, mode and scroll.

## Build / deploy / update ONE game

1. In the master: `bun scripts/export-host-packages.ts ticket` (or `hub`, or no args for all) →
   `/tmp/ayla-export/ayla-<target>/`.
2. Copy that folder over the game's own production project (keep its `.git`), `bun install`.
3. Publish only that project. Open `https://<host>/api/release`, read `buildId`.
4. First registration: set `{ catalogId, gameId, url, releaseId: buildId }` and activate the release.
   Later publishes at the same origin need no registry edit or hub redeploy: the hub reads the actual
   public host version before promoting its preload. Changing origin or withdrawing still uses the registry.
5. Rollback = point the registry back to the previous host/releaseId, or set `active=false`.

Secrets: AI story / picture / narration routes use `LOVABLE_API_KEY` (Lovable AI Gateway) in each game
project. Without it games use their original prepared fallback content; narration shows an honest error.
No music or ambience anywhere (finite effects + spoken story/instructions only).

## This installation's QA limits
The canonical project is prepared only in isolated draft4; no accept/publish or external registration
was performed. Real public gameplay/cutover awaits all eleven independently published registered hosts.
Focused synthetic host tests do not verify those external games, iPad listening or Safari gameplay.
Validation: 85 tests across 12 files passed. Chromium exercised mounted cross-origin fixture frames:
same-version document reuse; changed public build with unchanged registry; same-seed fresh nonce;
active-puzzle retention on failed release lookup; two-frame maximum. Live root rendered all key
courtyard images and zero playable cards (expected empty registry). No broad screenshot sweep.
The preview harness reported successful builds; manual production builds/typechecks are not run here.
