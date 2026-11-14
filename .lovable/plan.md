# Preview PR #1 branch (read-only) — capabilities

## Current preview
- Commit: 8759d4f ("Add project README"), on Lovable's internal edit branch. PR #1 (9587776) is not in this preview.

## What I can't do
- I can't point the preview at another GitHub branch or commit. Lovable previews only its synced branch (or a draft built from it).
- I won't fetch or check out the branch myself, because that would change the project's code state.
- I can only take the 393x852 screenshot of /play?band=3&t=sudoku&s=12345 after the preview is running that code.

## Steps for you in the editor
1. Open Project settings -> Git (or the + menu next to chat -> Project -> GitHub).
2. In the branch picker, choose `redesign/forest-sudoku-interface`. Lovable then syncs to its newest commit, which should be 9587776.
3. Wait for the preview to rebuild, then ask me for the screenshot.
4. To go back, choose `main` again in the branch picker.

Note: Switching branches changes which branch Lovable edits and syncs for the whole project. It does not merge anything. Any edits made while switched land on that branch.
