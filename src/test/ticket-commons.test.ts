import { describe, expect, it } from "vitest";
import { CATALOG_SNAPSHOT, isSafeThumbnailReference, playableTemplateIds } from "@/lib/public-catalog";
import { parseRouteBand } from "@/lib/commons-launch";
import { PUBLIC_GAMES } from "@/host/public-games";

describe("Ticket Machine (v1-riddle) public release", () => {
  it("is playable only for menu bands 4–6 (ages 7–10), not the engine's extra band 3", () => {
    for (const band of [4, 5, 6]) expect(playableTemplateIds(CATALOG_SNAPSHOT, band)).toContain("ticket");
    for (const band of [1, 2, 3]) expect(playableTemplateIds(CATALOG_SNAPSHOT, band)).not.toContain("ticket");
  });
  it("route parses the band unchanged (no clamp into eligibility)", () => {
    expect(parseRouteBand(3)).toBe(3);
    expect(parseRouteBand(2)).toBe(2);
  });
  it("is the eleventh public game", () => {
    expect(PUBLIC_GAMES[10]?.gameId).toBe("ticket");
    expect(PUBLIC_GAMES.find((g) => g.gameId === "ticket")).toMatchObject({ catalogId: "v1-riddle", path: "/ticket-machine", minBand: 4, maxBand: 6 });
  });
});

describe("release-service thumbnails", () => {
  const ok = "https://aylas-game-releases.coatedscarf3.chatgpt.site/thumbnails/v1-lineup/020dabd0b7e4aa0c2509ec826f42d8fe23a47f47e2651a3f2d8997e20931b353.png";
  it("accepts only the public content-addressed thumbnail path", () => {
    expect(isSafeThumbnailReference(ok)).toBe(true);
    expect(isSafeThumbnailReference(ok.replace(".png", ".webp"))).toBe(true);
  });
  it("still rejects every other chatgpt.site / private location", () => {
    for (const bad of [
      "https://aylas-game-releases.coatedscarf3.chatgpt.site/api/manifest.png",
      "https://aylas-game-releases.coatedscarf3.chatgpt.site/thumbnails/v1-lineup/short.png",
      "https://aylas-game-releases.coatedscarf3.chatgpt.site/private/v1-lineup/020dabd0b7e4aa0c2509ec826f42d8fe23a47f47e2651a3f2d8997e20931b353.png",
      `${ok}?x=1`,
      ok.replace("aylas-game-releases.coatedscarf3", "other.coatedscarf3"),
      ok.replace("https://", "http://"),
      "https://id-preview--abc.lovable.app/thumb.png",
    ]) expect(isSafeThumbnailReference(bad)).toBe(false);
  });
});
