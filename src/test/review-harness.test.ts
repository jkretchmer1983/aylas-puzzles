import { describe, expect, it } from "vitest";
import { REVIEW_CHILD_ORIGINS, reviewTargets } from "@/host/review-origins";
import { PUBLIC_GAMES } from "@/host/public-games";
import { isPrivateQaOrigin } from "@/host/origins";

const real = [
  { gameId: "sofa", releaseId: "r1", origin: "https://aylas-sofa-has-had-enough.lovable.app" },
  { gameId: "robot", releaseId: "r2", origin: "https://aylas-robot-shortcut.lovable.app" },
];

describe("private review harness", () => {
  it("never swaps origins on the canonical hub or any published origin", () => {
    expect(reviewTargets(real, "https://aylas-puzzles.lovable.app")).toBeNull();
    expect(reviewTargets(real, "https://example.com")).toBeNull();
  });

  it("on the private hub preview, keeps real eligibility and swaps only the origin to each child's private preview", () => {
    const hub = "https://id-preview-6--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app";
    expect(reviewTargets(real, hub)).toEqual([
      { gameId: "sofa", releaseId: "r1", origin: "https://id-preview-3--768d609f-c8f2-4324-b46a-4e824d0084eb.lovable.app" },
      { gameId: "robot", releaseId: "r2", origin: "https://id-preview-3--58c66c34-baf4-4363-9f6f-2ac46726ea2a.lovable.app" },
    ]);
    expect(reviewTargets([], hub)).toEqual([]);
  });

  it("maps every public game to an exact private preview origin", () => {
    // Water has no supplied private review draft origin yet; it is excluded rather than guessed.
    for (const game of PUBLIC_GAMES.filter((g) => g.gameId !== 'water')) expect(isPrivateQaOrigin(REVIEW_CHILD_ORIGINS[game.gameId] ?? '')).toBe(true);
    expect(REVIEW_CHILD_ORIGINS.water).toBeUndefined();
    expect(Object.keys(REVIEW_CHILD_ORIGINS)).toHaveLength(13);
  });
});
