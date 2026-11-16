# Taking Away — rendered airfield review

Branch: `review/take-rendered-airfield`, based on `review/take-balloon-interaction` at `74f71931e5cbd240e8f84676bfe53e26b0ee8ac9`.
Route: `/take-preview`. Review only; do not merge, accept or publish.

## Artwork and reference

Reference supplied in this conversation: `3D77AE1E-61E3-4934-9394-70DD3CA34040.jpeg`. The warm, tactile open-sky airfield, landscape/river lighting, stitched orange fabric, explorer, windsock, linen, leather, brass and carved-key surfaces define this scene. Production raster layers live in `public/take-airfield/`, generated from the reference with built-in ImageGen. The landscape removes all fixed puzzle objects and UI; a 2×2 transparent sprite atlas supplies balloon, anchor, explorer and windsock; a separate happy waving pose supplies the explorer reaction without moving her rock, and a 2×3 transparent control atlas supplies blank banner, suitcase, number key, green Check, beige navigation button and flight log. The atlases were sliced, alpha-trimmed and WebP encoded without replacing their painted materials with CSS. Essential text, quantities, rope geometry and hit targets remain deterministic live layers.

The reference is a style/composition reference, not mathematical source data. The displayed 8-minus-3 board has eight starting balloons, three released and five remaining; no baked decorative balloons add to the count. Other generated object types use one matching parcel per balloon, preserving task meaning. The pilot still starts with Ages 4–5; existing age selection and all other game routes remain accessible and unchanged.

## Interaction and state

- Anchored balloons bob only a few pixels. Separate SVG strings visibly connect fabric knots and fixed metal anchors.
- Hold 300 ms, or begin dragging, to lift. Stable vertical offset 64 CSS px; no side switching. The displayed balloon center, not the raw finger, controls the broad upper-sky threshold with 8 px tolerance. A hold alone cannot accidentally commit a release.
- Invalid drops return smoothly. Pointer cancellation and rotation cancel only the current gesture. Tap/keyboard selection plus Release remains available. Synchronous committed state prevents duplicate releases before React paints.
- Released strings curl; balloons accelerate upward with wind drift and shrink into the sky. Remaining balloons stay in separated slots. Controls remain live during flight.
- Undo recalls exactly one most-recent balloon (including from a multi-selection release), retains answer/work, removes its flying sprite and returns it to its original anchor. Public clues and generator-owned numeric validation remain separate; manipulation is an aid, not a second correctness gate.
- An entered answer activates Check with brightness and a gentle pulse. Incorrect feedback is an unmistakable friendly banner and the same physical control becomes a red Try again. Retry keeps all work and selects the answer for replacement; it never resets the board.
- Correct feedback triggers the released fleet's playful chevron swoop, windsock flutter and explorer reaction, then emphasizes Next puzzle. Reduced motion bypasses continuous motion and provides immediate static feedback.
- A cached generated flight log uses the existing story service with its original fallback and deadline. Story opening and gameplay retain the same mounted landscape; camera/framing and the objects move continuously into place. New changes only board seed/work, retaining story and play phase. Next creates a new adventure; Previous restores prior work. Board, answer, story, selection and released IDs persist in the isolated browser session.
- Spoken instructions require a gesture and are cancellable. Release sounds are opt-in and obey mute. Settings include reduced motion. Controls use semantic buttons and live feedback.

## Validation

Strict TypeScript, production build and all 57 tests pass. The four additional physical-scene tests cover same-control retry with retained work, one-balloon recall during flight, displayed-center offset release and duplicate prevention, rotation state, and invalid-drop cancellation. Generator/mapping tests cover all existing take object variants and bands without changing generator output. Browser checks cover 393×852 phone portrait, phone landscape, wider portrait, iPad portrait and landscape, wrong/correct states, release/recall and state continuity. Browser input is pointer/mouse based; physical iPhone touch feel and actual spoken/sound output remain device review items.

This is a reference-matched working prototype, not a pixel-for-pixel screenshot overlay. Scene architecture reflows to retain readable targets, especially on short landscape phones. No main changes, merges or publishing.

## Suitcase reference revision — 16 November 2026

The attached `IMG_0337.jpeg` close-up replaces the earlier generic control atlas as the suitcase specification. Built-in ImageGen extracted reference-based raster layers: the wide cream/brown suitcase with its recessed answer window, eight ivory keys, amber Undo plaque and green Check hardware; matching Story Flightlog/Hint books; and the unified three-button leather navigation strip. Physical materials and hardware are raster artwork, while labels, answer, validation and button semantics remain live. Final assets are versioned `public/take-airfield/*-reference-v2.webp`. Prompts specify background extraction, original lighting/perspective/materials, removal of printed text only, and no invented hardware. ImageGen reproduces the reference closely but is not a pixel-identical extraction.

The suitcase uses its native 1958:803 ratio at every size. Live controls register to the painted recess and keys; the keypad matches the reference's 1–8 row, covering every valid answer in the unchanged Ages 4–5 generator. The answer field still accepts numeric keyboard entry. The existing retry test uses 8 as its deliberately incorrect answer (all generated valid answers are 1–7). Check glow, same-control retry, Undo, success departure, random numbers and saved state are preserved. Short landscape reserves separate horizontal space for the wider case so its clearance calculation cannot lift the balloon grid off-screen.
