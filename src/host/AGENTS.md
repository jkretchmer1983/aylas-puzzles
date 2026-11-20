# Hub host rules

- Approved child loaders (src/host/loader-capabilities.ts) suppress the hub starting veil; games flagged for compact slow recovery keep the same 20 s slow state and Try again/All games handlers in a content-sized edge panel over their live document. Why: long real loaders and their own fallback controls must stay visible without faking readiness or changing timeouts.
- Hub top Next/Previous change game type (history/forward in the stored session); same-game New is child-owned; standalone arrows use a one-shot /session step. Why: navigation semantics stay in one place across hosts.
- /review is a private-QA-only harness: real SessionShell with child origins swapped from review-origins.ts, never registry data. Why: cross-draft review without touching production eligibility.
- Previous/forward restores re-verify the target's registered origin and public release before leaving the current puzzle, then reload the same instance in a fresh latest-release document. Why: independently released hosts must never resume on an unverified build.
- Directional `next` (direction ±1) is accepted only from games in `supportsTypeNavigation` (protocol.ts); the hub maps -1 to Previous and +1 to Next on the shared type navigation, never arbitrary URL navigation. Why: hosts that cannot send `previous` still get hub-owned eligibility and the same saved-work history.
