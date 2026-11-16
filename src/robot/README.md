# The Robot Took a Shortcut — isolated review

- Route: `/robot`, intentionally absent from `/` and the released-game allowlist.
- Review ages are provisional: band 4 (7–8) uses 5×5 and 2 stops; band 5 (8–9) uses 5×5, 3 stops and repeat blocks; band 6 (9–10) uses 6×6, 4 stops and ordered deliveries. No 7×7 board is enabled.
- `generator.ts` builds a self-avoiding witness first and derives stops, obstacles and command budget from it. `engine.ts` alone owns movement, delivery and success.
- `RobotScene.tsx` draws a separate real-time Three.js robot and dynamic tile contents over the cleaned reference-derived depot. An event-owned bounded macrotask scheduler advances runs independently of WebGL; the reducer enforces run/cursor guards and commit-once behavior.
- WebGL preflight, an error boundary and context-loss handling keep the route playable. `RobotSceneFallback.tsx` uses a dynamic projected yard and four transparent direction frames rendered from the same `RobotModel`; it does not rotate a flat image. The fallback has discrete direction changes and a simplified deposit animation rather than full 3D secondary motion.
- Reference-derived trolley, transparent fabric, paving and rock assets contain no baked live tokens or text. Normal devices retain real 3D.
- `themes.ts` uses the shared versioned instance-content contract in `src/lib/instance-content.ts`; the existing story and illustration APIs are consumed unchanged.
- Integration gap: the existing shared story writer returns title/story/imagePrompt only, not a structured binding. Robot therefore owns its curated structured binding, validates that AI text preserves every parcel and destination, and falls back to coordinated generator text when it does not. Other released adapters are unchanged.
- New board keeps the instance story/theme and changes only the board seed. Next creates a fresh instance. Previous uses client navigation and session-saved work. Rotation does not remount an adventure.
- Development checks can use `window.__robot`: `state`, `visualPose`, `dispatch`, `loadWitness()`, `run()`, `stop()`, `reset()`, `newBoard()`, `next()`, and `previous()`. The scene exposes `data-scene-ready` on `.robot-three` after WebGL creation (`fallback` in projected mode).
- Shared Design Brief v6 (15 November) was identified by the user in ChatGPT Library as `Aylas-Puzzles-Shared-Design-Brief.txt`; no copy exists in this repository. Root `AGENTS.md` remains the local rules source.
