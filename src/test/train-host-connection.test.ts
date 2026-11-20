import { describe, expect, it } from "vitest";
import { PUBLIC_GAMES, publicGameById, publicGameByCatalogId } from "@/host/public-games";
import { buildLaunchUrl, isGameRelativeHref, makeMessage, parseChildMessage } from "@/host/protocol";
import { hubPlayableGames, parseReleaseManifest } from "@/host/manifest";
import { roleAdapterResolver, sessionTargets } from "@/host/eligibility";
import { CATALOG_SNAPSHOT, gamesForBand } from "@/lib/public-catalog";
import { startSession, reserveNext, promoteNext, parseStoredSession, withCurrentHref } from "@/host/session-queue";
import { Route } from "@/routes/session";

const origin = "https://aylas-train-tangle.lovable.app";
const identity = { session: "session123", nonce: "nonce1234", gameId: "trains" };
const train = publicGameById("trains");
if (!train) throw new Error("Train connection missing");
const record = CATALOG_SNAPSHOT.records.find((item) => item.id === "v2-trains");
if (!record) throw new Error("Train catalog missing");
const manifest = (over = {}, registered = true) => parseReleaseManifest({
  catalog: { version: 2, revision: "test", records: [{ ...record, name: "Live desk title", release: "available", minAge: 4, maxAge: 10, ...over }] },
  registry: { version: 1, revision: "test", games: registered ? { "v2-trains": { catalogId: "v2-trains", gameId: "trains", url: origin, releaseId: "test-release" } } : {} },
});

describe("train host connection", () => {
  it("has exactly one train lookup with the approved fixed entry point", () => {
    expect(train).toEqual({ catalogId: "v2-trains", gameId: "trains", title: "The Great Train Tangle", path: "/adventures", fixed: { game: "trains" }, seedParam: "seed", minBand: 1, maxBand: 6 });
    expect(publicGameByCatalogId("v2-trains")).toBe(train);
    expect(PUBLIC_GAMES.filter((item) => item.gameId === "trains")).toHaveLength(1);
    expect(new Set(PUBLIC_GAMES.map((item) => item.gameId)).size).toBe(14);
  });

  it("uses live title, artwork and age eligibility for the age-seven card and session targets", () => {
    const m = manifest();
    const live = m.catalog.records[0];
    if (!live) throw new Error("Missing live train record");
    const card = gamesForBand(m.catalog, 4, roleAdapterResolver(m.catalog, m.registry))[0];
    expect(card?.name).toBe("Live desk title");
    expect(card?.thumbnail).toBe(record.thumbnail);
    expect(card?.adapter?.templateId).toBe("trains");
    expect(sessionTargets(m.catalog, m.registry, 4, "http://localhost:8080")).toEqual([{ gameId: "trains", origin, releaseId: "test-release" }]);
    for (const band of [1, 2, 3, 4, 5, 6]) expect(hubPlayableGames(m, band).map((item) => item.game.gameId)).toEqual(["trains"]);
    expect(hubPlayableGames(manifest({ minAge: 8 }), 4)).toEqual([]);
    expect(hubPlayableGames(manifest({ hidden: true }), 4)).toEqual([]);
    expect(hubPlayableGames(manifest({ release: "coming-soon", nextAction: "Done" }), 4)).toEqual([]);
    expect(hubPlayableGames(manifest({}, false), 4)).toEqual([]);
  });

  it("launches and restores only the fixed train path with seeded preparation", () => {
    const url = new URL(buildLaunchUrl({ origin, game: train, band: 4, identity, phase: "prepare", seed: 42 }));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/adventures");
    expect(Object.fromEntries(url.searchParams)).toEqual({ game: "trains", band: "4", seed: "42", from: "commons", host_session: identity.session, host_nonce: identity.nonce, host_game: "trains", host_phase: "prepare" });
    const href = "/adventures?game=trains&band=4&age=7&seed=42&deal=2&from=commons";
    expect(parseChildMessage(makeMessage("location", identity, { href }), identity)?.href).toBe(href);
    const restored = new URL(buildLaunchUrl({ origin, game: train, band: 4, identity, phase: "active", seed: 99, resumeHref: href }));
    expect(restored.searchParams.get("seed")).toBe("42");
    expect(restored.searchParams.get("deal")).toBe("2");
  });

  it("accepts only train age 3–10 and numeric deals without loosening other games", () => {
    for (const age of [3, 4, 5, 6, 7, 8, 9, 10]) expect(isGameRelativeHref(train, `/adventures?game=trains&age=${age}`)).toBe(true);
    for (const query of ["game=robot", "game=trains&game=robot", "game=trains&age=2", "game=trains&age=11", "game=trains&age=07", "game=trains&age=https%3A%2F%2Fevil.app", "game=trains&deal=-1", "game=trains&deal=abc", "game=trains&deal=1&deal=2", "game=trains&next=https%3A%2F%2Fevil.app", "game=trains&game=https%3A%2F%2Fevil.app"]) expect(isGameRelativeHref(train, `/adventures?${query}`)).toBe(false);
    expect(isGameRelativeHref(train, "/adventures?age=7")).toBe(false);
    expect(isGameRelativeHref(train, "//evil.app/adventures?game=trains")).toBe(false);
    const robot = publicGameById("robot");
    if (!robot) throw new Error("Robot missing");
    for (const field of ["game=trains", "age=7", "deal=1"]) expect(isGameRelativeHref(robot, `/robot?${field}`)).toBe(false);
    expect(parseChildMessage({ ...makeMessage("ready", identity), nonce: "wrongnonce" }, identity)).toBeNull();
  });

  it("keeps train single routing, fresh Next, saved location and Play all through the shared queue", () => {
    const validate = Route.options.validateSearch;
    if (typeof validate !== "function") throw new Error("Session search validator missing");
    expect(validate({ band: 4, mode: "single", game: "trains" })).toEqual({ band: 4, mode: "single", game: "trains" });
    const eligible = [{ gameId: "trains", releaseId: "test-release" }, { gameId: "money-change", releaseId: "till-release" }];
    const session = startSession(4, "single", eligible, "trains", () => 0.1);
    if (!session?.current) throw new Error("Train session missing");
    const href = "/adventures?game=trains&age=7&seed=42&deal=1";
    const saved = withCurrentHref(session, session.current.instanceId, href);
    expect(parseStoredSession(saved)?.current?.href).toBe(href);
    const next = promoteNext(reserveNext(saved, eligible, () => 0.2), eligible);
    expect(next?.band).toBe(4);
    expect(next?.current?.gameId).toBe("trains");
    expect(next?.current?.seed).not.toBe(session.current.seed);
    expect(next?.current?.instanceId).not.toBe(session.current.instanceId);
    const all = startSession(4, "all", eligible, undefined, () => 0);
    if (!all) throw new Error("Play all missing");
    expect(all.current?.gameId).toBe("trains");
    expect(promoteNext(reserveNext(all, eligible), eligible)?.current?.gameId).toBe("money-change");
  });
});