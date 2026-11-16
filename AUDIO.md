# Audio guide (all games, V1 and V2)

Shared modules — never add a game-local `speechSynthesis` or `AudioContext`:

| Module | Role |
| --- | --- |
| `src/lib/audio/narrator.ts` | One narrator. `speak(id, text)` inside a tap handler; `stopNarration()`. Picks an English voice, re-picks on `voiceschanged`, stops on hidden tab/pagehide, 4 s honest-error watchdog, ducks mixer. |
| `src/lib/audio/speech-text.ts` | Verbalizes visible text only: emoji nouns, `¢`/`$`, ordinals, `×` `+` `=` `?` blanks, `…`. Never adds facts or answers. |
| `src/lib/audio/mixer.ts` | One AudioContext; master / music / effects buses; persisted settings (`aylas-audio-v1`: muted, voice, effects, music, musicVolume); ducking; one procedural music track at a time; suspend on hidden tab. |
| `src/lib/audio/profiles.ts` | **Registry.** `AUDIO_PROFILES` (music motif + action/place/success/retry/begin effects) and `TEMPLATE_AUDIO` (template → profile). |
| `src/lib/audio/use-scene-audio.ts` | Per-screen hook: music starts on first pointerdown/keydown, scene switch replaces the track, unmount releases it; click-capture action sounds. |
| `src/components/ReadAloud.tsx` | The only speaker button. Pass the exact current visible text. |
| `src/components/AudioSettings.tsx` | Master mute + voice/effects/music + music volume. |

## Required for every new game adapter
1. Add the template id to `TEMPLATE_AUDIO` (or add a new profile with its own tempo, scale, instruments, drum pattern and effects). `src/test/audio.test.tsx` fails when a template is missing or two profiles share a music signature.
2. Use `useSceneAudio(template, instanceKey)`; call `effect('success'|'retry')` from the generator-checked result and `effect('place')` on real piece actions. Never sound on pointermove.
3. Every story/instruction/clue speaker is `<ReadAloud text={currentVisibleText} />`.
4. Expose `<AudioSettings />` somewhere on the screen.
5. Verify in a browser: speaker taps call speak with current text, music schedules after a tap, no page errors. Mocked tests are not audible verification.

Drafts and remixed projects do not inherit these files; copy `src/lib/audio/*`, `ReadAloud.tsx`, `AudioSettings.tsx`, `forest-audio.ts` shim and the styles block "Shared audio controls" explicitly.

## Unlock, recovery and honest status (required for every adapter)
- iOS/WebKit only treats `click`, `touchend` and `keydown` as user activation; `pointerdown`/`touchstart` are NOT. The mixer installs a repeatable global unlock on those events that retries until `AudioContext.state === 'running'` (including after iOS `interrupted`), plays a one-sample silent buffer, and sets `navigator.audioSession.type = 'playback'` where supported (Safari 17+ Audio Session API).
- `getAudioStatus()` (`unsupported|locked|running|error`) drives the UI; never show "on" unless the context is confirmed running.
- `AudioSettings` must stay reachable in every game: Enable sound (shown while locked), Test sound (plays a chime and measures real rendered output via an AnalyserNode on the master bus, `testSound()`), and Test voice (shared narrator). Saved mute is respected; tests report muted/effects-off instead of playing.
- Real-output check: `python3 scripts/check-sound-output.py` (Playwright, real Web Audio, no mocks). Headless Chromium proves rendered PCM energy; the sandbox WebKit has no audio device, so it only proves the blocked state is reported honestly. Neither replaces listening on a real iPad.
