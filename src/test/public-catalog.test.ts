import { describe, expect, it } from "vitest";
import rawSnapshot from "@/lib/catalog-snapshot.json";
import { CATALOG_THUMBNAILS } from "@/lib/catalog-thumbnails";
import { CATALOG_SNAPSHOT, gamesForBand, parsePublicCatalog, playableGamesForBand } from "@/lib/public-catalog";

 describe("Puzzle Commons catalog", () => {
  it("contains the corrected 45-record export with 39 visible and six hidden", () => {
    expect(CATALOG_SNAPSHOT.records).toHaveLength(45);
    expect(CATALOG_SNAPSHOT.records.filter((record) => !record.hidden)).toHaveLength(39);
    expect(CATALOG_SNAPSHOT.records.filter((record) => record.hidden).map((record) => record.id).sort()).toEqual([
      "v1-coins", "v1-colors", "v1-compare", "v2-cabbage", "v2-harbour", "v2-toast",
    ]);
    // The race game's record ID is v1-lineup and it stays visible (Coming soon).
    const lineup = CATALOG_SNAPSHOT.records.find((record) => record.id === "v1-lineup");
    expect(lineup?.hidden).toBe(false);
    expect(lineup?.release).toBe("available");
    expect(gamesForBand(CATALOG_SNAPSHOT, 1).some((game) => game.id === "v1-compare")).toBe(false);
  });

  it("requires the whole selected age range, not merely an overlap", () => {
    const youngest = gamesForBand(CATALOG_SNAPSHOT, 1);
    expect(youngest.some((game) => game.id === "v1-count")).toBe(true);
    expect(youngest.some((game) => game.id === "v1-sudoku")).toBe(false);
    const oldest = gamesForBand(CATALOG_SNAPSHOT, 6);
    expect(oldest.some((game) => game.id === "v1-sudoku")).toBe(true);
    expect(oldest.some((game) => game.id === "v1-pattern")).toBe(false);
    expect(oldest.some((game) => game.id === "v2-dinosaur")).toBe(false);
  });

  it("launches only installed adapters inside each game's full dashboard age range", () => {
    const ids = (band: number) => playableGamesForBand(CATALOG_SNAPSHOT, band).map((game) => game.adapter?.templateId).sort();
    expect(ids(1)).toEqual(["airship", "curiosity", "seaside", "sofa", "take"]);
    expect(ids(2)).toEqual(["airship", "curiosity", "ordering", "seaside", "sofa", "sudoku", "take"]);
    expect(ids(3)).toEqual(["curiosity", "ordering", "radio", "seating", "sofa", "sudoku", "take"]);
    expect(ids(4)).toEqual(["curiosity", "ordering", "radio", "robot", "seating", "sofa", "sudoku", "ticket"]);
    expect(ids(6)).toEqual(["ordering", "radio", "robot", "seating", "sofa", "sudoku", "ticket"]);
    expect(playableGamesForBand(CATALOG_SNAPSHOT, 1).some((game) => game.id === "v2-curiosity")).toBe(true);
    expect(playableGamesForBand(CATALOG_SNAPSHOT, 6).some((game) => game.id === "v2-curiosity")).toBe(false);
  });

  it("uses all 41 exact selected local thumbnail assets and no external image URLs", () => {
    expect(Object.keys(CATALOG_THUMBNAILS)).toHaveLength(41);
    expect(new Set(Object.values(CATALOG_THUMBNAILS)).size).toBe(41);
    for (const [file, url] of Object.entries(CATALOG_THUMBNAILS)) {
      // CDN pointer in the master; exported host packages serve the same bytes from public/portable-assets.
      expect(url).toMatch(/^\/(?:__l5e\/assets-v1|portable-assets)\//);
      expect(url.endsWith(`/${file}`)).toBe(true);
    }
  });

  it("does not expose dashboard launch or production metadata", () => {
    const serialized = JSON.stringify(rawSnapshot);
    for (const privateKey of ["launchUrl", "launchSource", "launchKind", "published", "scene"]) {
      expect(serialized).not.toContain(privateKey);
    }
    expect(serialized).not.toContain("id-preview");
    // The only chatgpt.site references allowed are the release service's public content-addressed thumbnails.
    expect(serialized.replace(/https:\/\/aylas-game-releases\.coatedscarf3\.chatgpt\.site\/thumbnails\/v[12]-[a-z0-9-]+\/[0-9a-f]{64}\.(?:png|jpe?g|webp)/g, "")).not.toContain("chatgpt.site");
  });

  it("rejects feeds that try to add private destinations or invalid ages", () => {
    const record = CATALOG_SNAPSHOT.records[0]!;
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, launchUrl: "https://id-preview.example" }] })).toThrow();
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, minAge: 0 }] })).toThrow();
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, maxAge: 100 }] })).toThrow();
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, minAge: 4.5 }] })).toThrow();
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, id: "../play" }] })).toThrow();
  });
});
