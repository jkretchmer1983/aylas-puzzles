# Ayla’s Puzzles — public hub (thin menu)

Role `hub`: the canonical menu at https://aylas-puzzles.lovable.app. It serves only `/` and `/session`, reads the public release manifest, and launches each registered game host in a full-viewport iframe. It contains no game engines; a game becomes playable here the moment the manifest marks it `release: "available"` AND the registry holds its host URL — no hub republish.

- Source version: `50b7764` (Scene Games private master). Config: `src/host/host.config.json`.
- Server routes included: `/api/public/catalog`, `/api/release`.
- Supplied courtyard and thumbnail bytes are preserved through project-owned CDN asset pointers.
- Focused session, public release, protocol and catalog tests travel with this package (`bunx vitest run`).

## Install into a fresh Lovable TanStack Start project
1. Copy every file of this folder over the new project (keep its own `.git`); run `bun install`.
2. Do not edit `src/routeTree.gen.ts`; it regenerates on dev/build. Pages of other games exist only as redirect stubs.
3. Server secrets: AI story/picture/narration routes use `LOVABLE_API_KEY` (Lovable AI Gateway). Without it the game falls back to its original prepared stories/scenes and narration reports an honest error.
4. For this draft, STOP before acceptance or publication. Canonical root switches LAST, only after
   all eleven hosts are independently public/registered and release is explicitly authorized.

See `docs/HOSTING.md` for the protocol, registry contract and the update-one-game procedure.
