# Audio guide (all games, V1 and V2)

## Current policy — effects and narration only
No background music or looping ambience anywhere until explicitly requested again. This supersedes all previous music requirements, including custom and legacy adapters. The music scheduler, buses and profile scores are removed; compatibility music exports are inert and must never create nodes/timers. Ignore old saved music fields. Never restart audio sources on visibility, navigation or preferences. Sound tests are finite effects, not loops.

Shared modules — never add a game-local `speechSynthesis` or `AudioContext`:

| Module | Role |
| --- | --- |
| `src/lib/audio/narrator.ts` | One narrator. `speak(id, text)` inside a tap handler; `stopNarration()`. `narrationPayload({title, story, task})` builds the combined text; long text is chunked by sentence (≤180 chars) and every chunk is pinned to the voice selected at tap time. Saved voice choice (`setVoice`), re-picks on `voiceschanged` only between sequences, stops on hidden tab/pagehide, 4 s honest-error watchdog, ducks mixer. Never cancels before speak unless something is queued (Safari drops speak after cancel). |
| `src/lib/audio/speech-text.ts` | Verbalizes visible text only: emoji nouns, `¢`/`$`, ordinals, `×` `+` `=` `?` blanks, `…`. Never adds facts or answers. |
| `src/lib/audio/mixer.ts` | One AudioContext; master / effects buses; persisted settings (`aylas-audio-v1`: muted, voice, effects only); duck effects during speech; track and stop scheduled/active effects on mute, scene change, hidden tab and pagehide. |
| `src/lib/audio/profiles.ts` | **Registry.** `AUDIO_PROFILES` (finite action/place/success/retry/begin effects) and `TEMPLATE_AUDIO` (template → profile). |
| `src/lib/audio/use-scene-audio.ts` | Per-screen hook: click-capture action/place effects; route/instance cleanup. No automatic playback. |
| `src/components/ReadAloud.tsx` | The only speaker button: `<ReadAloud group={instanceKey} content={{title, story, task}} />`. Errors render visibly beside the button. |
| `src/components/AudioSettings.tsx` | Master mute + voice/effects; Enable sound, finite Test sound and separate Test voice. |

## Required for every new game adapter
1. Add the template id to `TEMPLATE_AUDIO` (or add a profile with scene-appropriate finite effects). Tests fail when an actual template is missing. Never add a music score or loop.
2. Use `useSceneAudio(template, instanceKey)`; call `effect('success'|'retry')` from the generator-checked result and `effect('place')` on real piece actions. Never sound on pointermove.
3. Every story AND instructions speaker for one puzzle is `<ReadAloud group={instanceKey} content={{ title, story, task }} />` with the SAME group and content, so either button reads the current story, then the current instructions ("Here is your puzzle. …"). Tapping again stops; a new instance/group cancels. Never put answers or hidden solution data in `content`.
4. Expose `<AudioSettings />` somewhere on the screen.
5. Verify both speakers with actual current generated story/task, all chunks in the same voice; measure real finite FX PCM and silence after settling, including reentry/visibility with old saved nonzero music. Mocked voice calls are not audible verification.

Drafts and remixed projects do not inherit these files; copy `src/lib/audio/*`, `ReadAloud.tsx`, `AudioSettings.tsx`, `forest-audio.ts` shim and the styles block "Shared audio controls" explicitly.

## Unlock, recovery and honest status (required for every adapter)
- iOS/WebKit only treats `click`, `touchend` and `keydown` as user activation; `pointerdown`/`touchstart` are NOT. The mixer installs a repeatable global unlock on those events that retries until `AudioContext.state === 'running'` (including after iOS `interrupted`), plays a one-sample silent buffer, and sets `navigator.audioSession.type = 'playback'` where supported (Safari 17+ Audio Session API).
- `getAudioStatus()` (`unsupported|locked|running|error`) drives the UI; never show "on" unless the context is confirmed running.
- `AudioSettings` must stay reachable in every game: Enable sound (shown while locked), Test sound (plays a chime and measures real rendered output via an AnalyserNode on the master bus, `testSound()`), and Test voice (shared narrator). Saved mute is respected; tests report muted/effects-off instead of playing.
- Real-output check: `python3 scripts/check-sound-output.py` (Playwright, real Web Audio, no mocks). Headless Chromium proves rendered PCM energy; the sandbox WebKit has no audio device, so it only proves the blocked state is reported honestly. Neither replaces listening on a real iPad.

## Local audit — November 17, 2026
Both `/play` and `/story-world` mount the same generator/Renderer, SceneMechanics and narration controls. All 30 templates were actually opened and both speakers tapped at 393×852 using offline generator fallback; recorded voice calls matched each current title/story/task, one selected voice throughout. Speech instrumentation was mocked; Web Audio construction/resume/rendering was NOT mocked. Every real gameplay tap had measurable PCM (minimum peak 0.01614), then zero live effects/music and silent output. Retry/win peaks were measured after real count answer checks on both routes; Next/Previous read back the original URL. Sudoku speakers were tapped in phone, portrait tablet and landscape tablet; the shared wrapper now retains the original speaker coordinates without stealing instruction text width.

| Local coverage | Templates / surfaces | Result |
| --- | --- | --- |
| `/play`, `/story-world` forest | sudoku | Both speakers and real piece FX verified |
| Both routes treehouse | pattern, size, position, missing, legs | Both speakers and real piece FX verified |
| Both routes river | sequence, nim, compare, evenodd, double | Both speakers and real piece FX verified |
| Both routes workshop | odd, lineup, sides, clock, colors | Both speakers and real piece FX verified |
| Both routes picnic | count, add, take, share, days | Both speakers and real piece FX verified |
| Both routes market | coins, balance, groups, change, fraction | Both speakers and real piece FX verified |
| Both routes temple | magic, cipher, riddle, shapepick | Both speakers and real piece FX verified |
| `/` and Story Worlds age selection | Navigation only, no puzzle narration | No background playback path |
| `src/puzzles/kit.tsx` | Unimported legacy helpers including SlotAssign drag | Not a locally mounted game; no independent audio engine; do not claim playable legacy coverage |
| MCP / image / OAuth metadata endpoints | No game UI | No audio adapter |

Finite Test sound confirmed real Chromium PCM. Native headless speech returned a visible error (not fake success). Sandbox WebKit returned a visible blocked/retry message. Real iPad listening and online AI-story speech were not verified this pass; current text binding is shared with the verified generator fallback.

Outstanding, NOT updated: draft `drft_01m7ea5zyeecwagphehyk34wx3` (Story worlds — age-adaptive redesign), `drft_01m7gqm7wse1vrxznnv83624ng` (Taking Away — balloon interaction review), `drft_01m7gvy72tfy6syc5jg0nvbcjh` (Pattern Loom interaction preview). Inventory reports these ready/behind; their source is not mounted and none was accepted/refreshed. External Train, V2 Logic Adventures and independent Scene Games sources are also absent. Integrate the shared review commit explicitly into each chosen source, preserve its visuals, remove any custom loops/controls and verify its actual adapter before claiming coverage. Existing loom/balloon/train FX profiles are preparation, not integration.
