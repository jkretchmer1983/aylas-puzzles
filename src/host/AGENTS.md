# Hub host rules

- Approved child loaders (src/host/loader-capabilities.ts) suppress the hub starting veil; games flagged for compact slow recovery keep the same 20 s slow state and Try again/All games handlers in a content-sized edge panel over their live document. Why: long real loaders and their own fallback controls must stay visible without faking readiness or changing timeouts.
- Directional type navigation (`next` with direction ±1) is accepted only for games in `supportsTypeNavigation` (protocol.ts); it steps through live eligible catalog order and returns to a seated exact instance, while plain Next keeps each game's original behaviour. Why: games with type-level Previous/Next need hub-owned eligibility without arbitrary URL navigation.
