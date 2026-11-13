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
- Play renders generator text directly (stable, never AI-rewritten) over template-specific SVG scenes with a separate decoration seed; when online, a richer AI picture streams in over the drawing via src/lib/art-cache.ts, which prefetches the next puzzle's picture during play. The drawing is the offline/failure fallback.
- Age bands map to three visual tiers (`tier-little`, `tier-mid`, `tier-big` in styles.css) that override theme tokens.
- Keep the picture reveal on a separate masked layer from image motion; begin after image load and loader dismissal so prefetched pictures also animate, without restarting for streamed frames.
