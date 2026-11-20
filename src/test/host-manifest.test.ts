import { describe, expect, it } from "vitest";
import { childAcceptsRecord, hubPlayableGames, parseReleaseManifest } from "@/host/manifest";
import { isPrivateQaOrigin } from "@/host/origins";
const PUBLIC = { selfOrigin: "https://robot-host.lovable.app", privateQa: false };
const QA = { selfOrigin: "https://id-preview--734562b7-9af6-4e5e-97e9-2466ddef3755.lovable.app", privateQa: true };
import { CATALOG_SNAPSHOT } from "@/lib/public-catalog";
import { PUBLIC_GAMES } from "@/host/public-games";
import { roleAdapterResolver, sessionTargets } from "@/host/eligibility";
import { buildLaunchUrl, isGameRelativeHref } from "@/host/protocol";

const rec = (id: string, over: Record<string, unknown> = {}) => ({ ...CATALOG_SNAPSHOT.records.find((r) => r.id === id)!, ...over });
const manifest = (records: unknown[], games: Record<string, unknown> = {}) => parseReleaseManifest({
  catalog: { version: 2, revision: "r1", records },
  registry: { version: 1, revision: "r1", games },
});
const reg = (catalogId: string, gameId: string, url = `https://${gameId}-host.lovable.app`) => ({ [catalogId]: { catalogId, gameId, url, releaseId: "b1" } });

describe("public release rules", () => {
  it("preserves the approved games plus trains and water; Pattern Loom is not public", () => {
    expect(PUBLIC_GAMES.map((g) => g.catalogId).sort()).toEqual(["v1-change", "v1-cipher", "v1-lineup", "v1-position", "v1-riddle", "v1-shapepick", "v1-sudoku", "v1-take", "v2-curiosity", "v2-robot", "v2-seating", "v2-sofa", "v2-trains", "v2-waterway"]);
    expect(CATALOG_SNAPSHOT.records.find((r) => r.id === "v1-pattern")!.release).toBe("coming-soon");
  });

  it("connects the registered Till to the age-seven hub card and existing session bridge", () => {
    const origin = "https://aylas-till-is-on-its-lunch-break.lovable.app";
    const m = manifest([rec("v1-change", { release: "available", nextAction: "Done", minAge: 6, maxAge: 10 })], {
      "v1-change": { catalogId: "v1-change", gameId: "money-change", url: origin, releaseId: "till-20261119023422-gekdo4" },
    });
    const game = PUBLIC_GAMES.find((item) => item.gameId === "money-change");
    expect(game).toEqual({ catalogId: "v1-change", gameId: "money-change", title: "The Till Is On Its Lunch Break", path: "/money-change", fixed: {}, seedParam: "s", minBand: 3, maxBand: 6 });
    if (!game) throw new Error("Till connection missing");
    expect(hubPlayableGames(m, 4).map((item) => item.game.gameId)).toEqual(["money-change"]);
    const record = m.catalog.records[0];
    if (!record) throw new Error("Till record missing");
    expect(roleAdapterResolver(m.catalog, m.registry)(record, 4)?.templateId).toBe("money-change");
    expect(sessionTargets(m.catalog, m.registry, 4, "http://localhost:8080")).toEqual([{ gameId: "money-change", origin, releaseId: "till-20261119023422-gekdo4" }]);
    const url = new URL(buildLaunchUrl({ origin, game, band: 4, seed: 42, phase: "active", identity: { session: "session123", nonce: "nonce1234", gameId: game.gameId } }));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/money-change");
    expect(url.searchParams.get("s")).toBe("42");
    expect(url.searchParams.get("host_game")).toBe("money-change");
    expect(isGameRelativeHref(game, "/money-change?band=4&s=42")).toBe(true);
    expect(isGameRelativeHref(game, "/ticket-machine?band=4&s=42")).toBe(false);
    expect(hubPlayableGames({ ...m, registry: { ...m.registry, games: {} } }, 4)).toEqual([]);
    expect(roleAdapterResolver(m.catalog, { ...m.registry, games: {} })(record, 4)).toBeUndefined();
  });

  it("hub plays a game only when available AND registered", () => {
    expect(hubPlayableGames(manifest([rec("v2-robot")], reg("v2-robot", "robot")), 4).map((g) => g.game.gameId)).toEqual(["robot"]);
    expect(hubPlayableGames(manifest([rec("v2-robot")]), 4)).toEqual([]);
    expect(hubPlayableGames(manifest([rec("v2-robot", { release: "coming-soon", nextAction: "Done" })], reg("v2-robot", "robot")), 4)).toEqual([]);
  });

  it("a released game stays playable while its workflow says Updating or In Development", () => {
    const m = manifest([rec("v2-robot", { nextAction: "In Development" })], reg("v2-robot", "robot"));
    expect(hubPlayableGames(m, 4)).toHaveLength(1);
    expect(childAcceptsRecord(m, "v2-robot", 4, PUBLIC)).toBe(true);
  });

  it("hidden and age bounds still withdraw a released game", () => {
    expect(hubPlayableGames(manifest([rec("v2-robot", { hidden: true })], reg("v2-robot", "robot")), 4)).toEqual([]);
    expect(hubPlayableGames(manifest([rec("v2-robot", { minAge: 8 })], reg("v2-robot", "robot")), 4)).toEqual([]);
    expect(hubPlayableGames(manifest([rec("v2-robot")], reg("v2-robot", "robot")), 3)).toEqual([]);
  });

  it('dashboard expansion beyond tested bands governs hub and child gates unchanged', () => {
    const expanded = manifest([rec('v2-robot', { minAge: 3, maxAge: 10 })], reg('v2-robot', 'robot'));
    for (const band of [1, 2, 3, 4, 5, 6]) {
      expect(hubPlayableGames(expanded, band).map((item) => item.game.gameId)).toEqual(['robot']);
      expect(childAcceptsRecord(expanded, 'v2-robot', band, PUBLIC)).toBe(true);
    }
    expect(hubPlayableGames(expanded, 0)).toEqual([]);
    expect(hubPlayableGames(expanded, 7)).toEqual([]);
  });

  it("private preview QA: unregistered + Done is accepted; registered needs available", () => {
    expect(childAcceptsRecord(manifest([rec("v2-robot", { release: "coming-soon", nextAction: "Done" })]), "v2-robot", 4, QA)).toBe(true);
    expect(childAcceptsRecord(manifest([rec("v2-robot", { release: "coming-soon", nextAction: "Updating" })]), "v2-robot", 4, QA)).toBe(false);
    expect(childAcceptsRecord(manifest([rec("v2-robot", { release: "coming-soon", nextAction: "Done" })], reg("v2-robot", "robot")), "v2-robot", 4, QA)).toBe(false);
  });

  it("published game origin fails closed without its own active release", () => {
    // Unregistered + Done is NOT enough on a public origin.
    expect(childAcceptsRecord(manifest([rec("v2-robot", { release: "coming-soon", nextAction: "Done" })]), "v2-robot", 4, PUBLIC)).toBe(false);
    // Available but not registered, or registered to another origin.
    expect(childAcceptsRecord(manifest([rec("v2-robot")]), "v2-robot", 4, PUBLIC)).toBe(false);
    expect(childAcceptsRecord(manifest([rec("v2-robot")], reg("v2-robot", "robot", "https://other.lovable.app")), "v2-robot", 4, PUBLIC)).toBe(false);
    // Withdrawn or hidden.
    expect(childAcceptsRecord(manifest([rec("v2-robot", { release: "withdrawn" })], reg("v2-robot", "robot")), "v2-robot", 4, PUBLIC)).toBe(false);
    expect(childAcceptsRecord(manifest([rec("v2-robot", { hidden: true })], reg("v2-robot", "robot")), "v2-robot", 4, PUBLIC)).toBe(false);
    // Active + own registry entry, also while the workflow says Updating.
    expect(childAcceptsRecord(manifest([rec("v2-robot", { nextAction: "Updating" })], reg("v2-robot", "robot")), "v2-robot", 4, PUBLIC)).toBe(true);
  });

  it("only Lovable private previews and localhost count as QA origins", () => {
    expect(isPrivateQaOrigin("https://id-preview--734562b7-9af6-4e5e-97e9-2466ddef3755.lovable.app")).toBe(true);
    expect(isPrivateQaOrigin("https://id-preview-4--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app")).toBe(true);
    expect(isPrivateQaOrigin("http://localhost:8080")).toBe(true);
    for (const o of ["https://robot-host.lovable.app", "https://aylas-puzzles.lovable.app", "https://id-preview--x.lovable.app", "https://id-preview--734562b7-9af6-4e5e-97e9-2466ddef3755.lovable.app.evil.com", "http://id-preview--734562b7-9af6-4e5e-97e9-2466ddef3755.lovable.app"]) {
      expect(isPrivateQaOrigin(o)).toBe(false);
    }
  });

  it("registry entries with private, mismatched or non-origin URLs are dropped", () => {
    for (const url of ["https://id-preview--x.lovable.app", "http://robot.lovable.app", "https://robot.lovable.app/robot", "https://robot.lovable.app?x=1", "https://user:pw@robot.lovable.app", "https://x.lovableproject.com"]) {
      expect(manifest([rec("v2-robot")], reg("v2-robot", "robot", url)).registry.games).toEqual({});
    }
    expect(manifest([rec("v2-robot")], reg("v2-robot", "sofa")).registry.games).toEqual({});
    expect(manifest([rec("v2-robot")], { "v1-pattern": { catalogId: "v1-pattern", gameId: "pattern", url: "https://p.lovable.app", releaseId: "1" } }).registry.games).toEqual({});
  });

  it("parses the live manifest shape (empty registry)", () => {
    const m = parseReleaseManifest({ catalog: { version: 2, revision: "seed.seed", records: [rec("v1-sudoku", { release: "coming-soon" })] }, registry: { version: 1, revision: "seed.seed", games: {} } });
    expect(hubPlayableGames(m, 3)).toEqual([]);
  });
});
