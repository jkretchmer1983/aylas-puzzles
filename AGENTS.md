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
- Forest Sudoku uses isolated wooden number pieces and round upper-corner controls, scoped to spatial play, so reference proportions do not alter other puzzles.
- Forest Sudoku uses cleaned uploaded artwork through CDN pointers and sizes its board and bark rack from available stage height; decorations yield first so artwork alignment and touch targets survive shorter screens.
- Sudoku board padding uses stage-relative bounded lengths, never percentages of its wider parent, and tablet decorations require sufficient viewport height; this prevents narrow distorted boards in short editor previews.
- Forest Sudoku places cached story art in StoryIllustrationFrame below compact shared controls, with an overlapping dynamic title; height-aware board sizing reserves the hint, answer check, feedback and root navigation so decoration yields before touch targets.
- SceneMechanics renders manipulatable visual clues from public task/visual data only; Renderer alone checks generator-owned answers, keeping physical play aids independent of correctness.
- Agent integrations: public MCP server in src/lib/mcp/ reuses the seeded generator and never returns answers; why: assistants get the same puzzles without exposing solutions.
- Forest Sudoku board grid tracks mirror the carved recesses measured from sudoku_board_blank (asymmetric rim, wider 2x2 gutters), and the story frame and title plaque are separate cutouts. Why: interactive cells and overlays must sit exactly on the painted art.
- Forest Sudoku renders one unified forest painting outside the fixed 393×852 foreground with the same uniform scale and center registration; only the original carved panel is composited back along its organic lip, never a rectangular center crop. Why: extra viewport space reveals forest without seams or changing board/control proportions.
- Story Worlds is an isolated /story-world alternative with scoped CSS; /play remains the tree experience. Why: alternatives must be reviewable without replacing existing play.
- Story Worlds freezes story/title/imagePrompt before painting or prefetching full-screen art in its own cache namespace; loader deadlines dismiss waiting without cancelling live generation. Why: narrative and artwork must agree, and offline/failure play must remain available.
- Renderer owns answers in both presentations; the optional Story Worlds presentation portals check controls into its reserved footer and uses tap-first pieces. Why: layout changes cannot duplicate or alter puzzle truth.
- Forest Sudoku phase one keeps the story and gameplay illustration in one mounted frame, with session-scoped entered cells/started state and awarded-score guard. Speech uses explicit browser gestures and cancels on view/navigation/unmount. Phase-two motion keeps that frame mounted, uses a cancellable 1.2s transition with inert game controls until settled, masks only freshly entered glyphs, and reveals loaded artwork separately from image motion. All decorative motion yields to prefers-reduced-motion. Sound is gesture-triggered, synthesized locally, and has a persistent Game settings mute control.
- Sudoku's empty carved hollows are painted directly into forest-carved-reference.jpg; the 16 transparent touch targets use measured source-image tracks registered to the scenery's single uniform scale. Never substitute CSS boxes or a raised board. Keep both bark edges visible, use the centered title-reference plaque and bundled Forest Lora/Nunito fonts, and reserve the result row above bottom navigation.

- Responsive forest portrait play selects the original 393×852 phone canvas or a 768×1100 broad canvas by available width/aspect ratio (forest-layout.ts), retaining one mounted puzzle across resizing. The broad canvas uses forest-tablet-portrait.jpg at 1.2× overscan and measured hollow tracks; never resize that painting independently of its target coordinates. Tablet surfaces have matching SVG end caps; the vertical rack must explicitly use flex and square 84px tiles. Landscape re-composition remains separate from this portrait pass.


<!-- DYNAMIC-CONTENT:BEGIN -->
## Shared requirement: fresh stories AND playable subjects

This latest requirement takes precedence over earlier notes that restrict AI to a rewritten caption. Mathematical facts remain immutable; presentation subjects can vary through validated structured bindings.

# Dynamic stories and playable objects — applies to every game

Every genuinely NEW puzzle instance must have fresh, coordinated narrative content and eligible playable object artwork, not merely different numbers or a rewritten caption over the same fixed fruit sprites. Friendly monsters, dinosaurs, robots, animals, fruit and other age-appropriate subjects can rotate independently of a game's approved setting. The loom, cockpit, airfield and other engineered environments and tested controls remain stable.

Use one shared versioned content-generation policy consumed by all game adapters. Do not copy separate story prompts into each game. Generate a structured instance theme/subject binding, then derive the story, spoken instructions, illustration and actual manipulatives from that SAME binding. Persist the binding for the instance. A story about six monsters must show six playable monsters, not six apples beneath new text.

Correctness is generator-owned. Preserve exact counts, arithmetic, sequence unit and ordering, clue relationships, answer indices, difficulty and validation. Keep raw tasks/clues immutable; if presentation nouns change, use controlled structured substitutions and validate consistency, never a free AI rewrite of mathematical facts. AI must not generate answers or determine validation. Render exact quantity using code from reusable object assets, never ask a scene illustration to establish quantity.

Use game-specific semantic restrictions: coin denominations, clock hands, required shape sides/corners, color-mixing rules, animal leg counts and identity-based logic clues remain correct and visible. A monster may replace a counted apple, but cannot arbitrarily replace a triangle, 5-cent coin, or four-legged animal unless its required properties and all dependent clues are explicitly preserved. Repeated symbols use identical subject mappings across the entire pattern/equation.

Stories should be genuinely varied, playful, clever, age-appropriate and connected to the selected objects and exact task. Vary premise, characters and situation; track recent themes to reduce immediate repeats. Keep stories short and avoid answer leaks. Match readable tactile art to each approved scene; new objects do not require rebuilding its geometry or controls.

Fresh launch / Next creates a new instance ID and seed unless explicitly resuming or following a reproducible shared puzzle link. Refresh of an explicit instance, Previous, orientation changes, rerenders and animation never regenerate it or lose work. New numbers/board retains current story and subject theme as already specified. Theme/image caches key by instance/theme/policy version, never game type alone. Persist stable instance mappings so story, audio, images and pieces cannot disagree or race.

Provide clear loading and bounded failure behavior. Offline or AI failure rotates through a curated compatible theme library rather than silently claiming a static sample is newly generated. Do not embed credentials in clients. Use approved backend secret configuration.

Acceptance: consecutive new instances of each adapter must show different eligible subjects and premises; actual draggable/tappable objects, instruction nouns, clues and illustration agree. Test seed reproducibility, Previous/resume, New numbers, rotation, fallback, async races and all semantic restrictions. A changed story alone does NOT satisfy this requirement.

Implementation status at this policy update: existing shared story writer only returns title/story/imagePrompt and locks original names; per-instance manipulatives are not yet a completed shared feature. This policy is an implementation requirement, NOT a claim that current previews already support it. Do not mark complete until functional previews demonstrate it.

<!-- DYNAMIC-CONTENT:END -->


<!-- SCENE-RELEASE:BEGIN -->
## Independent Scene Games public release
- V1 scene-game public destination: https://aylas-puzzles-scene-games.lovable.app/ . Lovable project: f6472ef2-e352-4eea-bebd-b2ca3e651718 (Ayla’s Puzzles — Scene Games).
- Source integration branch: release/scene-games in jkretchmer1983/aylas-puzzles, starting from the existing Sudoku scene baseline. Submit finished V1 game changes for review against this branch, not main. No automatic merge is authorized.
- Keep original published app/project 0a7ba2f9-7210-4e52-9220-51a3c422ad05 and its public address intact. Do not deploy this new release to the original project.
- The remixed Scene Games Lovable project is independent: original GitHub game branches do NOT automatically sync into it. After reviewing/integrating a game on release/scene-games, explicitly import the chosen version into the new project's draft, test build/gameplay/responsiveness and publish to its existing slug only when release is authorized. Do not claim a branch commit or preview automatically updated the public site.
- Initial new site contains the copied baseline; loom and balloon review branches are not yet integrated. Add ready games incrementally, keeping unfinished prototypes out of public rotation.
- V2 Logic Adventures Beta project c7960d92-dee8-4b06-b59c-5a53fe272e8c remains a distinct track; this V1 release direction does not authorize redirecting, overwriting or publishing that project.
<!-- SCENE-RELEASE:END -->

- Audio only via src/lib/audio + ReadAloud (both speakers read story+task; storybook voice via /api/tts on the shared Web Audio context, device speech as fallback; see AUDIO.md); register templates in TEMPLATE_AUDIO; unlock only on click/touchend/keydown. No background music until explicitly requested.
