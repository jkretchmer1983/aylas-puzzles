<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the phone puzzle view in a dynamic-viewport flex layout with a reserved feedback row and navigation; measure and fit the puzzle stage so changing puzzle content cannot push these controls off-screen.
- Puzzles are generated, not hand-written: `src/gen/templates.ts` holds seeded templates (seed in the URL makes a puzzle reproducible); answers come only from the generator, and the AI may rewrite title/story but never the task, so correctness never depends on AI output.
- Play shows an AI-rewritten title/story (src/lib/story-cache.ts, prefetched for the next puzzle) only after the loader waits for it, then freezes it for the puzzle; generator text is the fallback over template-specific SVG scenes with a separate decoration seed; when online, a richer AI picture streams in over the drawing via src/lib/art-cache.ts, which prefetches the next puzzle's picture during play. The drawing is the offline/failure fallback.
- Age bands map to three visual tiers (`tier-little`, `tier-mid`, `tier-big` in styles.css) that override theme tokens.
- Keep the picture reveal on a separate masked layer from image motion; begin after image load and loader dismissal so prefetched pictures also animate, without restarting for streamed frames.
- Puzzle types are dealt per age band like a shuffled deck (src/gen/deck.ts) so every type plays before any repeats.
- Each template maps to one of a few real full-screen places (STAGES in PuzzleWorld); pieces are styled per `stage-*` as objects of that place. Keep local material surfaces and template-specific game treatments in PuzzleWorld, independent of streamed storyline art; Renderer retains generator-owned answers and uses the game Button variant so tactile styling never changes Apple navigation.
- Play uses a continuous illustrated environment with cropped illustrated wooden objects and separate state-driven foreground controls; spatial puzzles prioritize the carved board, while story windows remain compact and expandable. Why: preserve reference artwork fidelity without baking dynamic puzzle values into images.
- ForestObjects owns reusable wooden controls and layered SVG engraving; Renderer alone validates answers. Why: visual depth must not change puzzle correctness.
- Forest Sudoku sizes its board and bark rack from the available stage height instead of shrinking the whole interface; isolated wooden artwork keeps scene edges aligned and touch targets usable.
- SceneMechanics renders manipulatable visual clues from public task/visual data only; Renderer alone checks generator-owned answers, keeping physical play aids independent of correctness.
