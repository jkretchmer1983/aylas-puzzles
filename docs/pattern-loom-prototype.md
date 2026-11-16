# The Pattern Loom — interaction pilot

Review branch: `prototype/pattern-loom`. Scope: Patterns only. Based on shared brief version 4 and the attached warm textile-loft render. No production art integration yet.

## Storyboard

1. Ready: read numbered patches from left to right on a continuous woven band; the final pocket is empty. Side pegs preserve the generator's shuffled choice order.
2. Pickup: hold 330ms to lift with a stable center 52px above the finger, or select using a button. Movement before the hold cancels pickup.
3. Placement: the visible patch center enters the pocket's 26px forgiving margin; pocket responds. Drop elsewhere returns to the peg in 230ms. Tap/keyboard select then activate pocket also works.
4. Replacement: pick any other choice and activate the pocket; Undo removes it. No validation or correctness colors before Check.
5. Wrong: red textual feedback, same handle becomes Try again, sequence remains. Retry permits replacement.
6. Correct: beater presses, stitches interlace, cloth feeds toward roller briefly. Next becomes primary. Repeat checking is disabled.

## Responsive compositions

| Surface | Composition |
| --- | --- |
| Phone portrait | Full-width loom, side peg rack, scrollable single band, check below, navigation outside scroll region |
| Wider phone | Loom gains width; patches retain square proportions |
| iPad portrait | Larger patches and broader cloth; no fixed narrow phone container |
| iPad landscape | Broad loom and side rack; sequence remains linear |
| Short landscape | Pegs move into a horizontal side rack; content scrolls rather than shrinking controls |

## Generator inspection

`pattern` is enabled in bands 0–6, including the repository's Ages 3–4 band. This pilot preserves availability; the brief's exclusion of 3–4 is not applied globally. Generator units progress through AB, AAB, ABC, ABBC, ABCCB. Display lengths reach 14 existing patches plus the empty pocket. Symbols include animals, fruit, vehicles, weather and sports; three choices retain exact index mapping. Validation stays in Renderer. No generator or Sudoku edits.

## Prototype / full-scene boundary

This is an interaction review surface, not the finished reference-fidelity scene. Emoji symbols deliberately preserve identities before an embroidery asset library exists. The final artwork pass needs independent loft/character, blank woven cloth, patch bases, pegs, warp, beater, roller and handle layers. Never use the complete reference as a backdrop with baked-in sample symbols.

Existing generated story text is available from Story. New retains the displayed story; Next uses existing deck navigation and its story generation. Previous restores the same seeded puzzle and in-session placed/result state. State survives responsive reflow. Instructions are user-triggered speech with mute; no automatic audio. Reduced motion follows the device. Full continuous intro assembly, unique loom-specific story generation/illustrations, optional fabric sounds, expanded reference art, and device touch QA remain for the scene integration pass.

## Review URL

Run `npm run dev -- --host 0.0.0.0`; open `/play?band=1&t=pattern&s=12345`. Also review bands 2–6 and `/play?band=6&t=pattern&s=45678` for long cloth.

## Validation

16 tests pass, including all seven generator bands, deferred checking, retry/replacement, repeat-check prevention, press-and-hold dragging, visible-center hit testing and missed-drop return. TypeScript and production build pass. Chromium launch is blocked by the environment (socket operation denied), so visual and physical-device QA remain unverified.
