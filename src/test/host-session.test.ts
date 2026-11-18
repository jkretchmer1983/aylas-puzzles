import { describe, expect, it } from "vitest";
import { pickNextGame, promoteNext, reserveNext, revalidateSession, startSession, parseStoredSession, type Eligible } from "@/host/session-queue";

const E = (...ids: string[]): Eligible[] => ids.map((gameId) => ({ gameId, releaseId: `r-${gameId}` }));
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };

describe("hub session queue", () => {
  it("single mode: Next is a fresh instance of the SAME game (new instance ID and seed)", () => {
    const s = startSession(3, "single", E("sofa", "robot"), "sofa")!;
    const r = reserveNext(s, E("sofa", "robot"));
    expect(r.reserved!.gameId).toBe("sofa");
    expect(r.reserved!.instanceId).not.toBe(s.current!.instanceId);
    expect(r.reserved!.seed).not.toBe(s.current!.seed);
    const p = promoteNext(r, E("sofa", "robot"))!;
    expect(p.current).toEqual(r.reserved);
  });

  it("single mode refuses a game that is not eligible", () => {
    expect(startSession(3, "single", E("robot"), "sofa")).toBeNull();
  });

  it("Play all: reservation does not mark a game played; promotion does", () => {
    const eligible = E("a", "b", "c");
    const s = startSession(3, "all", eligible, undefined, seq(0))!;
    expect(s.seen).toEqual([s.current!.gameId]);
    const r = reserveNext(s, eligible, seq(0));
    expect(r.seen).toEqual(s.seen);
    const p = promoteNext(r, eligible)!;
    expect(p.seen).toEqual([s.current!.gameId, r.reserved!.gameId]);
    expect(p.reserved).toBeNull();
  });

  it("Play all: every eligible game plays once before any repeats, never back-to-back", () => {
    const eligible = E("a", "b", "c", "d");
    let s = startSession(3, "all", eligible, undefined, Math.random)!;
    const order = [s.current!.gameId];
    for (let i = 0; i < 7; i++) { s = promoteNext(reserveNext(s, eligible), eligible)!; order.push(s.current!.gameId); }
    expect(new Set(order.slice(0, 4)).size).toBe(4);
    expect(new Set(order.slice(4, 8)).size).toBe(4);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });

  it("Play all with one eligible game deals a fresh instance of it; zero eligible starts nothing", () => {
    const s = startSession(1, "all", E("seaside"))!;
    const p = promoteNext(reserveNext(s, E("seaside")), E("seaside"))!;
    expect(p.current!.gameId).toBe("seaside");
    expect(p.current!.instanceId).not.toBe(s.current!.instanceId);
    expect(startSession(1, "all", [])).toBeNull();
    expect(pickNextGame([], [], undefined)).toBeUndefined();
  });

  it("reservation stays fixed across registry version changes until the public host check", () => {
    const s = reserveNext(startSession(4, "single", E("robot"), "robot")!, E("robot"));
    expect(reserveNext(s, E("robot"))).toBe(s);
    const changed = [{ gameId: "robot", releaseId: "r-new" }];
    const p = promoteNext(s, changed)!;
    expect(p.current).toEqual(s.reserved);
  });

  it("promotion returns null when nothing is eligible any more; revalidation drops a withdrawn current game", () => {
    const s = reserveNext(startSession(4, "single", E("robot"), "robot")!, E("robot"));
    expect(promoteNext(s, [])).toBeNull();
    expect(revalidateSession(s, [])).toBeNull();
    expect(revalidateSession(s, E("robot"))).toBe(s);
  });

  it("stored sessions restore strictly", () => {
    const s = reserveNext(startSession(2, "all", E("a", "b"))!, E("a", "b"));
    expect(parseStoredSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseStoredSession({ ...s, mode: "x" })).toBeNull();
    expect(parseStoredSession({ ...s, current: { ...s.current, instanceId: "../x" } })).toBeNull();
  });
});
