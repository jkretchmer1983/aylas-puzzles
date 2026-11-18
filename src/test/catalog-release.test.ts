import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG_THUMBNAILS } from "@/lib/catalog-thumbnails";
import {
  CATALOG_SNAPSHOT,
  gamesForBand,
  isSafeThumbnailReference,
  parsePublicCatalog,
  playableGamesForBand,
  playableTemplateIds,
  type PublicCatalog,
  type PublicCatalogRecord,
} from "@/lib/public-catalog";
import { CATALOG_CACHE_KEY, getCurrentCatalog, resetCatalogStoreForTests, setCurrentCatalog } from "@/lib/catalog-store";
import { dealPlayAllGame } from "@/lib/play-all";

function withRecord(id: string, patch: Partial<PublicCatalogRecord>): PublicCatalog {
  return parsePublicCatalog({
    ...CATALOG_SNAPSHOT,
    records: CATALOG_SNAPSHOT.records.map((record) => record.id === id ? { ...record, ...patch } : record),
  });
}

describe("catalog release status", () => {
  it("marks exactly the eleven workflow-Done games available in the snapshot (Pattern Loom is Coming soon)", () => {
    expect(CATALOG_SNAPSHOT.records.filter((r) => r.release === "available").map((r) => r.id).sort())
      .toEqual(["v1-cipher", "v1-lineup", "v1-position", "v1-riddle", "v1-shapepick", "v1-sudoku", "v1-take", "v2-curiosity", "v2-robot", "v2-seating", "v2-sofa"]);
    expect(CATALOG_SNAPSHOT.records.filter((r) => r.release === "withdrawn")).toHaveLength(0);
    expect(CATALOG_SNAPSHOT.records.filter((r) => r.hidden)).toHaveLength(6);
  });

  it("keeps the exact visible counts per age band", () => {
    expect([1, 2, 3, 4, 5, 6].map((band) => gamesForBand(CATALOG_SNAPSHOT, band).length))
      .toEqual([18, 26, 32, 33, 31, 23]);
  });

  it("withdrawing an installed game removes Play, /play eligibility and Play All immediately", () => {
    const catalog = withRecord("v1-sudoku", { release: "withdrawn" });
    const card = gamesForBand(catalog, 3).find((game) => game.id === "v1-sudoku");
    expect(card?.adapter).toBeUndefined();
    expect(playableTemplateIds(catalog, 3).sort()).toEqual(["curiosity", "ordering", "radio", "seating", "sofa", "take"]);
    expect(playableTemplateIds(catalog, 6).sort()).toEqual(["ordering", "radio", "robot", "seating", "sofa", "ticket"]);
    for (let i = 0; i < 8; i++) expect(dealPlayAllGame(3, playableTemplateIds(catalog, 3), "take")?.id).not.toBe("sudoku");
    const onlySofa = withRecord("v2-robot", { release: "withdrawn" });
    const sixth = parsePublicCatalog({ ...onlySofa, records: onlySofa.records.map((r) => ["v2-seating", "v1-sudoku", "v1-lineup", "v1-cipher", "v1-riddle"].includes(r.id) ? { ...r, release: "withdrawn" as const } : r) });
    expect(playableTemplateIds(sixth, 6)).toEqual(["sofa"]);
  });

  it("a newly available concept without an installed adapter stays non-playable", () => {
    const catalog = withRecord("v2-trains", { release: "available" });
    expect(gamesForBand(catalog, 3).find((game) => game.id === "v2-trains")?.adapter).toBeUndefined();
    expect(playableGamesForBand(catalog, 3).some((game) => game.id === "v2-trains")).toBe(false);
  });

  it("dashboard range changes override informational tested adapter ranges", () => {
    const catalog = withRecord("v1-take", { minAge: 4, maxAge: 10 });
    expect(playableTemplateIds(catalog, 3)).toContain("take");
    expect(playableTemplateIds(catalog, 4)).toContain("take");
    const airship = withRecord("v1-shapepick", { minAge: 4, maxAge: 10 });
    expect(playableTemplateIds(airship, 3)).toContain("airship");
  });

  it("accepts a new custom concept with a public thumbnail and ages 4–12, kept Coming soon", () => {
    const thumbnail = "https://images.example.org/concepts/Moon-Market-2.png";
    const catalog = parsePublicCatalog({
      ...CATALOG_SNAPSHOT,
      records: [...CATALOG_SNAPSHOT.records, {
        id: "Moon-Market-2", name: "Moon Market", description: "Trade moon pebbles fairly.",
        minAge: 4, maxAge: 12, thumbnail, hidden: false, release: "available",
      }],
    });
    for (const band of [1, 2, 3, 4, 5, 6]) {
      const card = gamesForBand(catalog, band).find((game) => game.id === "Moon-Market-2");
      expect(card?.thumbnailUrl).toBe(thumbnail);
      expect(card?.adapter).toBeUndefined();
    }
    expect(playableTemplateIds(catalog, 3)).not.toContain("Moon-Market-2");
  });

  it("intersects dashboard ages 1–99 with the app's supported bands", () => {
    const teen = withRecord("v2-dinosaur", { minAge: 11, maxAge: 99 });
    expect([1, 2, 3, 4, 5, 6].some((band) => gamesForBand(teen, band).some((game) => game.id === "v2-dinosaur"))).toBe(false);
    const toddler = withRecord("v1-count", { minAge: 1, maxAge: 5 });
    expect(gamesForBand(toddler, 1).some((game) => game.id === "v1-count")).toBe(true);
  });

  it("accepts a valid empty catalog without restoring bundled games", () => {
    const empty = parsePublicCatalog({ version: 2, revision: "empty", records: [] });
    expect(playableTemplateIds(empty, 1)).toEqual([]);
    expect(gamesForBand(empty, 3)).toEqual([]);
  });
});

describe("catalog thumbnail references", () => {
  it("uses the record's chosen bundled thumbnail rather than its ID", () => {
    const catalog = withRecord("v1-sudoku", { thumbnail: "v1-pattern.jpg" });
    expect(gamesForBand(catalog, 3).find((game) => game.id === "v1-sudoku")?.thumbnailUrl).toBe(CATALOG_THUMBNAILS["v1-pattern.jpg"]);
  });

  it("uses an updated public HTTPS image reference from the feed", () => {
    const url = "https://images.example.org/ayla/sudoku-new.webp";
    const catalog = withRecord("v1-sudoku", { thumbnail: url });
    expect(gamesForBand(catalog, 3).find((game) => game.id === "v1-sudoku")?.thumbnailUrl).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://images.example.org/a.jpg",
    "https://id-preview--f6472ef2-e352-4eea-bebd-b2ca3e651718.lovable.app/a.jpg",
    "https://project--f6472ef2-dev.lovable.app/a.jpg",
    "https://lovable.dev/projects/abc/thumb.png",
    "https://desk.chatgpt.site/thumb.jpg",
    "https://aylas-puzzles-scene-games.lovable.app/play?band=1&t=sudoku",
    "https://images.example.org/a.jpg?token=secret",
    "https://user:pw@images.example.org/a.jpg",
    "https://127.0.0.1/a.jpg",
    "/play?t=sudoku",
    "../secret.jpg",
  ])("rejects unsafe thumbnail %s and the whole feed carrying it", (thumbnail) => {
    expect(isSafeThumbnailReference(thumbnail)).toBe(false);
    expect(() => withRecord("v1-sudoku", { thumbnail })).toThrow();
  });

  it("rejects unknown release states and launch destinations", () => {
    const record = CATALOG_SNAPSHOT.records[0]!;
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, release: "published" }] })).toThrow();
    expect(() => parsePublicCatalog({ ...CATALOG_SNAPSHOT, records: [{ ...record, launchUrl: "/play?t=count" }] })).toThrow();
  });
});

describe("shared current catalog", () => {
  beforeEach(() => { localStorage.clear(); resetCatalogStoreForTests(); });

  it("keeps an intentionally empty feed across reloads", () => {
    setCurrentCatalog({ version: 2, revision: "empty", records: [] });
    resetCatalogStoreForTests();
    expect(getCurrentCatalog().records).toEqual([]);
  });

  it("ignores invalid input and a corrupt device cache", () => {
    expect(() => setCurrentCatalog({ version: 2, revision: "x", records: [{ id: "bad" }] })).toThrow();
    expect(getCurrentCatalog()).toBe(CATALOG_SNAPSHOT);
    localStorage.setItem(CATALOG_CACHE_KEY, "{not json");
    resetCatalogStoreForTests();
    expect(getCurrentCatalog()).toBe(CATALOG_SNAPSHOT);
  });

  it("a withdrawal received mid-session gates the next navigation", () => {
    expect(playableTemplateIds(getCurrentCatalog(), 3)).toContain("sudoku");
    setCurrentCatalog(withRecord("v1-sudoku", { release: "withdrawn" }));
    expect(playableTemplateIds(getCurrentCatalog(), 3)).not.toContain("sudoku");
  });
});
