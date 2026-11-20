import { describe, expect, it } from "vitest";
import { PUBLIC_GAMES, publicGameById, publicGameByCatalogId } from "@/host/public-games";
import { buildLaunchUrl, isGameRelativeHref, makeMessage, parseChildMessage, supportsTypeNavigation } from "@/host/protocol";
import { hubPlayableGames, parseReleaseManifest } from "@/host/manifest";
import { sessionTargets } from "@/host/eligibility";
import { hasCompactSlowRecovery, hasPublishedChildLoader } from "@/host/loader-capabilities";
import { CATALOG_SNAPSHOT } from "@/lib/public-catalog";
import { parseStoredSession, promoteNext, reserveNext, startSession, stepSessionType, withCurrentHref, type Eligible } from "@/host/session-queue";
import { Route } from "@/routes/session";

const origin = "https://water-host.lovable.app";
const identity = { session: "session123", nonce: "nonce1234", gameId: "water" };
const water = publicGameById("water");
if (!water) throw new Error("Water connection missing");
const record = CATALOG_SNAPSHOT.records.find((item) => item.id === "v2-waterway");
if (!record) throw new Error("Waterway catalog missing");
const manifest = (over = {}, registered = true) => parseReleaseManifest({
  catalog: { version: 2, revision: "test", records: [{ ...record, ...over }] },
  registry: { version: 1, revision: "test", games: registered ? { "v2-waterway": { catalogId: "v2-waterway", gameId: "water", url: origin, releaseId: "water-release" } } : {} },
});
const E = (...ids: string[]): Eligible[] => ids.map((gameId) => ({ gameId, releaseId: `r-${gameId}` }));
const HREF = "/adventures?game=water&band=4&age=7&seed=31&deal=2&level=2&from=commons";

describe("water host connection", () => {
  it("has exactly one approved fixed entry point and its own loader", () => {
    expect(water).toEqual({ catalogId: "v2-waterway", gameId: "water", title: "The Cloud Hired a Plumber", path: "/adventures", fixed: { game: "water" }, seedParam: "seed", minBand: 1, maxBand: 6 });
    expect(publicGameByCatalogId("v2-waterway")).toBe(water);
    expect(PUBLIC_GAMES.filter((item) => item.gameId === "water")).toHaveLength(1);
    expect(hasPublishedChildLoader("water")).toBe(true);
    expect(hasCompactSlowRecovery("water")).toBe(false);
  });

  it("is not live until the release service marks it available AND registers it", () => {
    expect(record.release).not.toBe("available");
    expect(hubPlayableGames(manifest(), 4)).toEqual([]);
    expect(hubPlayableGames(manifest({ release: "available", nextAction: "Done" }, false), 4)).toEqual([]);
    const live = manifest({ release: "available", minAge: 6, maxAge: 10 });
    expect(hubPlayableGames(live, 4).map((item) => item.game.gameId)).toEqual(["water"]);
    expect(sessionTargets(live.catalog, live.registry, 4, "http://localhost:8080")).toEqual([{ gameId: "water", origin, releaseId: "water-release" }]);
    // Dashboard ages govern: ages 6–10 exclude band 1 (ages 3–4).
    expect(hubPlayableGames(live, 1)).toEqual([]);
    expect(hubPlayableGames(manifest({ release: "available", hidden: true }), 4)).toEqual([]);
  });

  it("launches only the fixed path and restores an exact water instance", () => {
    const url = new URL(buildLaunchUrl({ origin, game: water, band: 4, identity, phase: "prepare", seed: 42 }));
    expect(url.origin).toBe(origin);
    expect(Object.fromEntries(url.searchParams)).toEqual({ game: "water", band: "4", seed: "42", from: "commons", host_session: identity.session, host_nonce: identity.nonce, host_game: "water", host_phase: "prepare" });
    expect(parseChildMessage(makeMessage("location", identity, { href: HREF }), identity)?.href).toBe(HREF);
    const restored = new URL(buildLaunchUrl({ origin, game: water, band: 4, identity, phase: "active", seed: 99, resumeHref: HREF }));
    expect(restored.searchParams.get("seed")).toBe("31");
    expect(restored.searchParams.get("level")).toBe("2");
    expect(restored.searchParams.get("deal")).toBe("2");
  });

  it("accepts water age 3–10, numeric deal and level 1 or 2 only", () => {
    for (const age of [3, 7, 10]) expect(isGameRelativeHref(water, `/adventures?game=water&age=${age}`)).toBe(true);
    for (const level of [1, 2]) expect(isGameRelativeHref(water, `/adventures?game=water&level=${level}`)).toBe(true);
    for (const query of ["game=trains", "game=water&game=trains", "level=1", "game=water&level=0", "game=water&level=3", "game=water&level=1&level=2", "game=water&level=02", "game=water&age=11", "game=water&deal=x", "game=water&prepared=1", "game=water&next=https%3A%2F%2Fevil.app", "game=water&constructor=1", "game=water&__proto__=1"]) {
      expect(isGameRelativeHref(water, `/adventures?${query}`)).toBe(false);
    }
    expect(isGameRelativeHref(water, "//evil.app/adventures?game=water")).toBe(false);
    expect(isGameRelativeHref(water, "/water?game=water")).toBe(false);
    // Other games are not loosened: level stays unknown for trains and robot.
    const trains = publicGameById("trains");
    const robot = publicGameById("robot");
    if (!trains || !robot) throw new Error("Missing games");
    expect(isGameRelativeHref(trains, "/adventures?game=trains&level=1")).toBe(false);
    expect(isGameRelativeHref(trains, "/adventures?game=water")).toBe(false);
    expect(isGameRelativeHref(trains, "/adventures?game=trains&age=7&deal=1")).toBe(true);
    for (const field of ["level=1", "game=water", "age=7"]) expect(isGameRelativeHref(robot, `/robot?${field}`)).toBe(false);
  });

  it("validates directional next for water only and keeps the envelope checks", () => {
    expect(supportsTypeNavigation("water")).toBe(true);
    for (const id of PUBLIC_GAMES.map((g) => g.gameId).filter((g) => g !== "water")) expect(supportsTypeNavigation(id)).toBe(false);
    const next = makeMessage("next", identity);
    expect(parseChildMessage({ ...next, direction: 1 }, identity)?.direction).toBe(1);
    expect(parseChildMessage({ ...next, direction: -1 }, identity)?.direction).toBe(-1);
    expect(parseChildMessage(next, identity)?.direction).toBeUndefined();
    for (const direction of [0, 2, -2, "1", null, undefined, 1.5]) expect(parseChildMessage({ ...next, direction }, identity)).toBeNull();
    expect(parseChildMessage({ ...next, direction: 1, nonce: "wrongnonce" }, identity)).toBeNull();
    expect(parseChildMessage({ ...next, direction: 1, v: 2 }, identity)).toBeNull();
    expect(parseChildMessage({ ...makeMessage("back", identity), direction: 1 }, identity)?.direction).toBeUndefined();
    const sofa = { session: "session123", nonce: "nonce1234", gameId: "sofa" };
    const plain = parseChildMessage({ ...makeMessage("next", sofa), direction: 1 }, sofa);
    expect(plain?.type).toBe("next");
    expect(plain?.direction).toBeUndefined();
  });

  it("steps types in stable order with wrap, seats the leaving instance and restores a seat exactly", () => {
    const eligible = E("sofa", "water", "trains");
    const s = startSession(4, "single", eligible, "water")!;
    const seated = withCurrentHref(s, s.current!.instanceId, HREF);
    const forward = stepSessionType(seated, eligible, 1)!;
    expect(forward.session.current?.gameId).toBe("trains");
    expect(forward.session.seats?.water).toEqual(seated.current);
    expect(forward.session.mode).toBe("single");
    expect(forward.session.gameId).toBe("water");
    expect(stepSessionType(seated, eligible, -1)?.session.current?.gameId).toBe("sofa");
    const atEnd = withCurrentHref(forward.session, forward.session.current!.instanceId, "/adventures?game=trains&age=7&seed=5");
    expect(stepSessionType(atEnd, eligible, 1)?.session.current?.gameId).toBe("sofa"); // wraps
    // Back onto water: the exact seat, fresh document identity.
    const back = stepSessionType(atEnd, eligible, -1)!;
    expect(back.session.current?.gameId).toBe("water");
    expect(back.session.current?.href).toBe(HREF);
    expect(back.session.current?.seed).toBe(s.current!.seed);
    expect(back.session.current?.instanceId).not.toBe(s.current!.instanceId);
    expect(back.session.seats?.water).toBeUndefined();
    expect(back.session.seats?.trains?.href).toBe("/adventures?game=trains&age=7&seed=5");
  });

  it("reuses a prepared reservation of the arriving type, marks Play all seen, and refuses impossible steps", () => {
    const eligible = E("water", "trains");
    const all = startSession(4, "all", eligible, undefined, () => 0)!;
    expect(all.current?.gameId).toBe("water");
    const reserved = reserveNext(all, eligible);
    const step = stepSessionType(reserved, eligible, 1)!;
    expect(step.fromReserved).toBe(true);
    expect(step.session.current).toEqual(reserved.reserved);
    expect(step.session.reserved).toBeNull();
    expect(step.session.seen).toEqual(["water", "trains"]);
    expect(stepSessionType(startSession(4, "single", E("water"), "water")!, E("water"), 1)).toBeNull();
    expect(stepSessionType(all, E("trains", "sofa"), 1)).toBeNull(); // current no longer eligible
    // A seat for a type that is no longer eligible is never used.
    expect(stepSessionType({ ...all, seats: { sofa: { instanceId: "a".repeat(24), gameId: "sofa", seed: 1, releaseId: "r", href: "/sofa?seed=1" } } }, eligible, 1)?.session.current?.gameId).toBe("trains");
  });

  it("plain Next keeps its original behaviour and only records a seat", () => {
    const eligible = E("water", "trains");
    const s = startSession(4, "single", eligible, "water")!;
    const seated = withCurrentHref(s, s.current!.instanceId, HREF);
    const next = promoteNext(reserveNext(seated, eligible), eligible)!;
    expect(next.current?.gameId).toBe("water");
    expect(next.current?.href).toBeUndefined();
    expect(next.current?.seed).not.toBe(s.current?.seed);
    expect(next.seats?.water?.href).toBe(HREF);
    expect(promoteNext(reserveNext(s, eligible), eligible)?.seats).toBeUndefined();
  });

  it("restores stored seats strictly", () => {
    const s = startSession(4, "single", E("water", "trains"), "water")!;
    const seat = { ...s.current!, href: HREF };
    expect(parseStoredSession({ ...s, seats: { water: seat } })?.seats?.water).toEqual(seat);
    const parsed = parseStoredSession({ ...s, seats: { trains: seat, __proto__x: seat, nope: { ...seat, gameId: "nope" }, sofa: { ...seat, gameId: "sofa", href: undefined } } });
    expect(parsed?.seats).toBeUndefined();
    expect(parseStoredSession({ ...s, seats: "bad" })?.current).toEqual(s.current);
  });

  it("routes the card to a single water session", () => {
    const validate = Route.options.validateSearch;
    if (typeof validate !== "function") throw new Error("Session search validator missing");
    expect(validate({ band: 4, mode: "single", game: "water" })).toEqual({ band: 4, mode: "single", game: "water" });
  });
});
