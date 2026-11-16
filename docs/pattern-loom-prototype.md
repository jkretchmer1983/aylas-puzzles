# The Pattern Loom — reference-art development

Review branch: `prototype/pattern-loom`, draft PR #3. Scope is Patterns. The separate Lovable draft provides a hosted preview; neither is accepted or merged into main.

## Scene architecture

`PatternPrototype` composes the weaving-loft scene, story, instructions, audio settings and navigation. `PatternLoom` owns pickup, placement and weaving animation. `LoomArt` maps every one of the generator's 40 symbols to its embroidery atlas position. The cleaned portrait and landscape scene plates contain no baked-in puzzle values. Woven patch bases, fabric controls, a wooden check handle and beater are independent foreground elements.

The seeded generator and choice ordering are unchanged. Renderer validates the chosen index; scene art and generated story text cannot change correctness. All existing bands 0–6 remain available, including the repository's Ages 3–4 band. Patterns range from AB through ABCCB, up to fourteen given patches plus an empty final pocket. Rows are numbered in reading order.

## Interaction

- Hold 330ms to lift a patch. Its visible center stays 52px above the finger, with a forgiving 26px pocket margin used for highlighting and drop detection.
- Tap or keyboard-select a patch, then activate the pocket as an alternative.
- Replace a placed patch or Undo before checking. Placement never checks the answer.
- A wrong answer changes the wooden Check handle to Try again, with explicit red feedback.
- Success stitches the final patch, moves the beater, feeds the cloth and emphasizes Next puzzle.
- Previous restores in-session placement/result for a visited puzzle. New retains the story. Resize cancels an active pickup while preserving placement/result.
- Speech is user-triggered. Optional chimes and mute are available in settings. Both system and in-game reduced motion are supported.

## Review

Preview: https://id-preview-3--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app/play?band=1&t=pattern&s=12345

Long-pattern fixture: `/play?band=6&t=pattern&s=45678`.

## Validation

The final reference-art branch passes all 18 tests, TypeScript and the production build. Tests exercise every generator band, deferred checking, retry/replacement, repeat-check prevention, press-and-hold dragging, visible-center hit testing and missed-drop return. The hosted draft passes 52 tests and its typecheck/build. Its 35 band/viewport combinations passed, including 15-slot sequences. Browser checks cover tap/drag, retry, replacement, Undo, weaving, rotation, shuffled Next/Previous, New replacement, warmed offline play and reduced motion. An independent authenticated hosted check also confirmed wrong/retry/correct and returning from another game restores solved state. Audible sound quality was not independently assessed. Physical iOS touch behavior still needs device review.
