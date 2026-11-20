# Shared controls: type navigation + two levels — hub QA notes

Private hub draft only. Not accepted, merged or published. No production registry/catalog edits.

## What changed (hub)
- Top **Next** / **Previous** (child messages `next` / new `previous`) change PUZZLE TYPE in both card (single) and Play all sessions. `back` stays Home. Centre **New** stays inside the child and only reports `location`.
- Next: restores a forward entry left by Previous, otherwise promotes the one prepared next game (a different type from the shuffled no-repeat cycle) after the existing release check.
- Previous: restores the last different game from persisted type history (same instance, seed and reported location); hidden/withdrawn/wrong-age entries are skipped; with no history it opens the previous eligible type fresh.
- Only one eligible type: Next/Previous keep the current puzzle and show a notice (standalone arrival: Back to my puzzle / All games). Nothing is re-dealt.
- Standalone host arrows: `/session?band=B&mode=all&game=<gameId>&step=next|previous` is recorded, the address is cleaned immediately, and the step is consumed once (refresh never repeats it).
- Levels: location/resume accept `l`, `lv`, `lvl`, `level` (Train) at 1–2; legacy 3 is normalized to 2. Path, fixed fields, origin/source/session/nonce checks unchanged.
- Menu: while this load's registry is unknown, published games show **Checking…**; on a failed fetch they show **Try again** instead of Coming soon.

## Evidence
- Unit/component tests: 120 passed (14 files), including new session-queue, protocol and SessionShell cases.
- Browser (headless Chromium, local hub build) with an explicit isolated QA harness: manifest request fulfilled with the real live catalog plus a private registry pointing at `https://qa-<game>.ayla-harness.test` fixture hosts that speak the real protocol (hello/ready after init, location, next/previous/back) and serve `/api/release`. Real SessionShell identity, origin/source checks, release check, readiness and two-frame limit were exercised. Fixtures are stand-ins, not real game art or engines.
- Live menu (real manifest, no interception), ages 7–8: 10 ready cards; ready per band {"1": 6, "2": 8, "3": 9, "4": 10, "5": 10, "6": 9}.

| check | result | detail |
|---|---|---|
| portrait: menu shows published games as Checking (not Coming soon) while registry loads | PASS | checking=8 |
| portrait: single-launch top Next changes puzzle type | PASS | sofa -> trains |
| portrait: Previous restores the earlier game with its seed, work and level | PASS | {"gameId": "sofa", "seed": "1027830180", "work": "2", "level": "2", "build": "build-1"} |
| portrait: centre New keeps the same type and updates the saved location | PASS | /sofa?band=4&seed=470612298&from=commons&o=2&lvl=2 |
| portrait: Next after Previous returns to the same forward instance | PASS | trains seed 1852530492 |
| portrait: republished standby is replaced (new document, build-2) with the same reserved seed | PASS | robot seed=1124577418 |
| portrait: failed check keeps the current game safe | PASS | robot |
| portrait: Retry after failure changes type | PASS | ticket |
| portrait: Previous skips a now-hidden game | PASS | hid robot; went to trains |
| portrait: max iframes observed | PASS | 2 |
| portrait: Home returns to menu with same age | PASS | http://localhost:8080/?band=4 |
| portrait: Play all top Next changes type | PASS | robot -> ticket |
| portrait: standalone step=next opens a different type, cleans the URL, refresh keeps it | PASS | http://localhost:8080/session?band=4&mode=all -> ticket / after refresh ticket |
| portrait: standalone step=previous opens a different type | PASS | robot |
| portrait: legacy level 3 resume opens at level 2 with the same seed | PASS | band=4&seed=5&from=commons&lvl=2&host_session=legacyqa0001&host_nonce=a558999f28 |
| portrait: failed manifest shows Try again, not Coming soon, for published games | PASS | try-again buttons=8 |
| portrait: page errors | PASS |  |
| landscape: menu shows published games as Checking (not Coming soon) while registry loads | PASS | checking=8 |
| landscape: single-launch top Next changes puzzle type | PASS | sofa -> ticket |
| landscape: Previous restores the earlier game with its seed, work and level | PASS | {"gameId": "sofa", "seed": "678235790", "work": "2", "level": "2", "build": "build-1"} |
| landscape: centre New keeps the same type and updates the saved location | PASS | /sofa?band=4&seed=511077147&from=commons&o=2&lvl=2 |
| landscape: page errors | PASS |  |

## Screenshots (CDN)
- landscape-live-menu-ages7-8.png: /__l5e/assets-v1/aa98de2b-99a7-48ce-b5dd-d43c84ee88bc/controls-nav-landscape-live-menu-ages7-8.png
- landscape-menu-checking.png: /__l5e/assets-v1/6090ddae-b28a-46f6-9e3c-116bf4a10a92/controls-nav-landscape-menu-checking.png
- landscape-menu-ready.png: /__l5e/assets-v1/9d7c25b3-804c-4b40-a4e2-06f082a332fb/controls-nav-landscape-menu-ready.png
- landscape-single-next-type.png: /__l5e/assets-v1/752624e6-bf94-4e9d-8121-ccc91e74835b/controls-nav-landscape-single-next-type.png
- landscape-single-previous-restored.png: /__l5e/assets-v1/665e3352-0d0b-47c7-af29-dc39493a8fa4/controls-nav-landscape-single-previous-restored.png
- landscape-single-sofa-work.png: /__l5e/assets-v1/313eef3d-3e0d-4313-89b5-2381622c9634/controls-nav-landscape-single-sofa-work.png
- portrait-failure-safe.png: /__l5e/assets-v1/b8424ac0-986b-4516-812f-25b22d7f5641/controls-nav-portrait-failure-safe.png
- portrait-live-menu-ages7-8.png: /__l5e/assets-v1/ab54b817-d17e-40d8-9497-d944cb6087df/controls-nav-portrait-live-menu-ages7-8.png
- portrait-menu-checking.png: /__l5e/assets-v1/48462b20-1a81-4f25-9b9c-e845b9fbda18/controls-nav-portrait-menu-checking.png
- portrait-menu-failed.png: /__l5e/assets-v1/de23f5bd-acbe-40c8-8004-87d9e40e8cb3/controls-nav-portrait-menu-failed.png
- portrait-menu-ready.png: /__l5e/assets-v1/3a7a17f9-5991-46e3-a5c7-546d28858a6f/controls-nav-portrait-menu-ready.png
- portrait-single-next-type.png: /__l5e/assets-v1/85bfc657-cc23-410e-bf80-252dbfdf2047/controls-nav-portrait-single-next-type.png
- portrait-single-previous-restored.png: /__l5e/assets-v1/44b43e88-418d-4aae-8e11-f586a006b153/controls-nav-portrait-single-previous-restored.png
- portrait-single-sofa-work.png: /__l5e/assets-v1/92769148-15d5-41d0-8111-ea73b6d694b7/controls-nav-portrait-single-sofa-work.png
- portrait-standalone-step-next.png: /__l5e/assets-v1/5074fdb1-20b0-4f19-8b6b-138a82f1babd/controls-nav-portrait-standalone-step-next.png

## Limits
- Real updated child games were not exercised here: their previews do not yet accept this hub preview as parent. Covered next by the private review harness.
- Headless Chromium only; no physical iPad.
- Child games must send `previous` and keep levels at 1–2 themselves; the hub only routes and sanitizes.

## Private review harness (/review)

Review link (private hub preview, needs your Lovable login): https://id-preview-6--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app/review?band=4

- Opt-in route; works only when the hub runs on a private QA origin (`isPrivateQaOrigin`). On the canonical/published hub it launches nothing.
- Uses the real SessionShell: real manifest eligibility (age, hidden, release), identity/nonce, origin+source checks, readiness, two-frame limit, hidden-frame suppression. Only the child origin is swapped to each game's private review preview (`src/host/review-origins.ts`, 13 entries). Separate session storage from real play.
- Private previews are auth-walled (`/api/release` returns 401 anonymously). In review only, an unreadable version endpoint is recorded as `private-preview-unverified` on both sides instead of blocking Next; production keeps the strict check.

| check | result | detail |
|---|---|---|
| portrait: review picker lists real eligible games for ages 7–8 | PASS | 10 open links |
| portrait: review session loads the child from its private preview origin with real identity | PASS | https://id-preview-3--4256ada6-8d33-41e7-9785-c8235aa42260.lovable.app/play |
| portrait: Next opens a different game even though the preview's version endpoint is auth-walled | PASS | sudoku -> ordering |
| portrait: Previous restores the first game with its seed, work and level | PASS | {"gameId": "sudoku", "seed": "1494100211", "work": "1", "level": "2", "build": "private"} |
| portrait: centre New keeps the same game | PASS | 371708917 |
| portrait: never more than two frames | PASS | 2 |
| portrait: page errors | PASS |  |
| real private child without login: hub shows the honest slow screen, no fake ready | PASS | This adventure is taking a while to open.  Try again All games |
| landscape: review picker lists real eligible games for ages 7–8 | PASS | 10 open links |
| landscape: review session loads the child from its private preview origin with real identity | PASS | https://id-preview-3--4256ada6-8d33-41e7-9785-c8235aa42260.lovable.app/play |
| landscape: Next opens a different game even though the preview's version endpoint is auth-walled | PASS | sudoku -> trains |
| landscape: Previous restores the first game with its seed, work and level | PASS | {"gameId": "sudoku", "seed": "235276456", "work": "1", "level": "2", "build": "private"} |
| landscape: centre New keeps the same game | PASS | 49140922 |
| landscape: never more than two frames | PASS | 2 |
| landscape: page errors | PASS |  |

SIMULATED: the passing session checks above used stand-in pages served at the exact private preview origins (browser-level fulfil), not the real updated child games. The one real-origin check (no Lovable login in this sandbox) correctly ended on the honest slow screen with Try again / All games.

Not verified here: real child Next/Previous/New/levels inside the hub. Needs (1) each child draft to accept exact parent https://id-preview-6--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app on its private origin and send `previous`, and (2) a logged-in browser.

### Review screenshots (CDN)
- review-landscape-review-first-game.png: /__l5e/assets-v1/7aae0e4c-5064-40a8-8a3b-b26a2cdee0c7/review-harness-landscape-review-first-game.png
- review-landscape-review-next.png: /__l5e/assets-v1/ca0dcd06-6368-40c4-bce9-ace29e753550/review-harness-landscape-review-next.png
- review-landscape-review-picker.png: /__l5e/assets-v1/78b71545-619e-490a-8772-fe10d6fad28b/review-harness-landscape-review-picker.png
- review-landscape-review-previous.png: /__l5e/assets-v1/4b0c6edb-ee07-4227-99af-3760d825814c/review-harness-landscape-review-previous.png
- review-portrait-real-private-child-unauthenticated.png: /__l5e/assets-v1/8dd00092-95bb-44fe-92e3-5e1a32f4da35/review-harness-portrait-real-private-child-unauthenticated.png
- review-portrait-review-first-game.png: /__l5e/assets-v1/89263a5e-5d7d-4a1b-aee1-5e2a52d9dcd4/review-harness-portrait-review-first-game.png
- review-portrait-review-next.png: /__l5e/assets-v1/a39efb91-32e4-448d-a836-df07827b007f/review-harness-portrait-review-next.png
- review-portrait-review-picker.png: /__l5e/assets-v1/d13815c7-0b87-473c-9e27-fc151b3e766c/review-harness-portrait-review-picker.png
- review-portrait-review-previous.png: /__l5e/assets-v1/fe4c9085-8e99-4bd2-bf93-0f18c1a3301a/review-harness-portrait-review-previous.png
