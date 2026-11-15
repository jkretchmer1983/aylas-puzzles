# Taking Away interaction review

Review route: `/take-preview`. Branch: `review/take-balloon-interaction`.
Base: `4e89154994ae5f958e59eeec7477b04ad08fbdf3` from `redesign/forest-sudoku-interface`.

This is the interaction pilot from shared design brief version 4, not the final rendered scene. The existing `/play`, `/story-world`, generator, stories, navigation, scoring and Sudoku are retained. Preview uses the existing `generate('take', 1, seed)` for Ages 4–5 and the same numeric answer equality in Renderer. Scene geometry/model reads public task data only. Default seed is discovered from the real generator for the 8-minus-3 balloon example; New/Next use new seeded boards and all four existing object variants. Treat variants use matching one-unit parcels carried by balloons. No released-count validation gate and no automatic answer totals.

Interactions: hold 350 ms or move 9 px to lift; 74 px stable vertical finger offset; visible balloon center drives forgiving release-zone hit testing; invalid drops and cancelled/rotated drags return without committing. Tap/keyboard select plus Release, batch undo including during flight, optional counting marks, 0–9 answer keys, edit/check, opt-in cancellable speech, mute, reduced motion. Persistent state is isolated in the browser session. CSS reflows one mounted game between portrait and landscape. New replaces only board seed while retaining the flight log; Next creates a new instance, Previous restores it.

Verification: production build and 53 tests pass, including all 46 existing tests plus seven new generator/mapping, answer ownership, release/undo, counting, finger-offset hit-testing, and rotation tests. Browser-reviewed at phone portrait 393×852, phone landscape 852×393, wider portrait, and tablet compositions; tap-release, live dragging, incorrect/correct feedback, previous restoration, and state continuity checked. Live browser checks use mouse/touch emulation; physical iPhone feel and speech output need device review.

Existing strict TypeScript check issues remain in the base branch's Sudoku session optional properties and test query options; no new type errors were introduced. This prototype deliberately uses generator fallback story text and simple layered artwork. Full generated story/illustration integration, intro transition, older age grouped quantities, and final airfield art follow interaction review.

No main edits, merges, publishing, or edits to the shared Sudoku branch.
