import { describe, expect, it } from "vitest";
import {
  onlyCurrentEligible, parseStoredSession, pickNextGame, promoteNext, reserveNext, revalidateSession, standaloneSession,
  startSession, stepNext, stepPrevious, withCurrentHref, type Eligible, type HubSession,
} from "@/host/session-queue";

const E = (...ids: string[]): Eligible[] => ids.map((gameId) => ({ gameId, releaseId: `r-${gameId}` }));
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };
const next = (s: HubSession, eligible: Eligible[]) => stepNext(reserveNext(s, eligible), eligible)!;

describe("hub session queue: top Next/Previous change puzzle type", () => {
  it("single mode: top Next is a DIFFERENT game, never a new puzzle of the same game", () => {
    const s = startSession(3, "single", E("sofa", "robot"), "sofa")!;
    const r = reserveNext(s, E("sofa", "robot"));
    expect(r.reserved!.gameId).toBe("robot");
    const p = promoteNext(r, E("sofa", "robot"))!;
    expect(p.current).toEqual(r.reserved);
    expect(p.history).toEqual([s.current]);
  });

  it("single mode refuses a game that is not eligible", () => {
    expect(startSession(3, "single", E("robot"), "sofa")).toBeNull();
  });

  it("Play all: reservation does not mark a game played; promotion does", () => {
    const eligible = E("a", "b", "c");
    const s = startSession(3, "all", eligible, undefined, seq(0))!;
    const r = reserveNext(s, eligible, seq(0));
    expect(r.seen).toEqual(s.seen);
    const p = promoteNext(r, eligible)!;
    expect(p.seen).toEqual([s.current!.gameId, r.reserved!.gameId]);
    expect(p.reserved).toBeNull();
  });

  it("every eligible game plays once before any repeats, never back-to-back", () => {
    const eligible = E("a", "b", "c", "d");
    let s = startSession(3, "all", eligible, undefined, Math.random)!;
    const order = [s.current!.gameId];
    for (let i = 0; i < 7; i++) { s = next(s, eligible); order.push(s.current!.gameId); }
    expect(new Set(order.slice(0, 4)).size).toBe(4);
    expect(new Set(order.slice(4, 8)).size).toBe(4);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });

  it("Previous restores the earlier game's exact instance, seed and saved work; Next then returns forward", () => {
    const eligible = E("sofa", "robot", "ticket");
    const s = startSession(4, "single", eligible, "sofa")!;
    const worked = withCurrentHref(s, s.current!.instanceId, "/sofa?band=4&seed=99&lvl=2");
    const moved = next(worked, eligible);
    expect(moved.current!.gameId).not.toBe("sofa");
    const back = stepPrevious(withCurrentHref(moved, moved.current!.instanceId, "/robot?band=4&s=5"), eligible)!;
    expect(back.current).toEqual(worked.current);
    expect(back.forward.at(-1)!.instanceId).toBe(moved.current!.instanceId);
    const again = stepNext(back, eligible)!;
    expect(again.current!.instanceId).toBe(moved.current!.instanceId);
    expect(again.current!.href).toBe("/robot?band=4&s=5");
    expect(again.forward).toEqual([]);
  });

  it("Previous skips hidden, withdrawn or wrong-age history; without history it opens the previous eligible type fresh", () => {
    const s = startSession(4, "single", E("sofa", "robot", "ticket"), "sofa")!;
    const moved = promoteNext({ ...s, reserved: { ...s.current!, instanceId: "a".repeat(24), gameId: "robot" } }, E("sofa", "robot", "ticket"))!;
    const withoutSofa = E("ticket", "robot");
    const back = stepPrevious(moved, withoutSofa)!;
    expect(back.current!.gameId).toBe("ticket");
    expect(back.current!.instanceId).not.toBe(s.current!.instanceId);
    expect(back.history).toEqual([]);
  });

  it("Next skips a stale forward entry and a same-game reservation", () => {
    const eligible = E("sofa", "robot", "ticket");
    const s = startSession(4, "single", eligible, "sofa")!;
    const stale = { ...s, forward: [{ ...s.current!, instanceId: "b".repeat(24), gameId: "robot" }], reserved: { ...s.current!, instanceId: "c".repeat(24) } };
    const moved = stepNext(stale, E("sofa", "ticket"))!;
    expect(moved.current!.gameId).toBe("ticket");
    expect(moved.forward).toEqual([]);
  });

  it("only one eligible game: no type change is invented and nothing new is dealt", () => {
    const s = startSession(1, "all", E("seaside"))!;
    expect(onlyCurrentEligible(s, E("seaside"))).toBe(true);
    expect(reserveNext(s, E("seaside")).reserved).toBeNull();
    expect(stepNext(s, E("seaside"))).toBeNull();
    expect(stepPrevious(s, E("seaside"))).toBeNull();
    expect(startSession(1, "all", [])).toBeNull();
    expect(pickNextGame([], [], undefined)).toBeUndefined();
  });

  it("standalone arrows step relative to the standalone game", () => {
    const eligible = E("a", "b", "c");
    const from = standaloneSession(4, eligible, "b");
    expect(stepNext(from, eligible)!.current!.gameId).not.toBe("b");
    expect(stepPrevious(from, eligible)!.current!.gameId).toBe("a");
    expect(stepPrevious(standaloneSession(4, eligible, "a"), eligible)!.current!.gameId).toBe("c");
  });

  it("reservation stays fixed across registry version changes until the public host check", () => {
    const s = reserveNext(startSession(4, "single", E("robot", "sofa"), "robot")!, E("robot", "sofa"));
    expect(reserveNext(s, E("robot", "sofa"))).toBe(s);
    const p = promoteNext(s, [{ gameId: "robot", releaseId: "r-new" }, { gameId: "sofa", releaseId: "r-new" }])!;
    expect(p.current).toEqual(s.reserved);
  });

  it("revalidation drops a withdrawn current game and a same-game legacy reservation", () => {
    const s = reserveNext(startSession(4, "single", E("robot", "sofa"), "robot")!, E("robot", "sofa"));
    expect(promoteNext(s, [])).toBeNull();
    expect(revalidateSession(s, [])).toBeNull();
    expect(revalidateSession(s, E("robot", "sofa"))).toBe(s);
    expect(revalidateSession({ ...s, reserved: { ...s.current!, instanceId: "d".repeat(24) } }, E("robot", "sofa"))!.reserved).toBeNull();
  });

  it("stored sessions restore strictly, including type history; older sessions without history still restore", () => {
    const s = next(startSession(2, "all", E("a", "b"))!, E("a", "b"));
    expect(parseStoredSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const { history: _h, forward: _f, ...legacy } = s;
    expect(parseStoredSession(legacy)).toEqual({ ...s, history: [], forward: [] });
    expect(parseStoredSession({ ...s, mode: "x" })).toBeNull();
    expect(parseStoredSession({ ...s, current: { ...s.current, instanceId: "../x" } })).toBeNull();
    expect(parseStoredSession({ ...s, history: [{ instanceId: "../x" }] })).toBeNull();
  });
});
