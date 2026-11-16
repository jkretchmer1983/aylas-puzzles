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
