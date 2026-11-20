import { describe, expect, it } from "vitest";
import { buildLaunchUrl, isGameRelativeHref, makeMessage, normalizeGameHref, parseChildMessage, parseParentMessage, readLaunchIdentity } from "@/host/protocol";
import { publicGameById } from "@/host/public-games";
import { allowedParentOrigins, devParentOrigins, exactHttpsOrigin } from "@/host/origins";

const id = { session: "aaaaaaaaaaaa1111", nonce: "bbbbbbbbbbbb2222", gameId: "robot" };

describe("hub ⇄ game protocol", () => {
  it("accepts only exact protocol, version and identity", () => {
    expect(parseChildMessage(makeMessage("next", id), id)?.type).toBe("next");
    expect(parseChildMessage(makeMessage("previous", id), id)?.type).toBe("previous");
    expect(parseChildMessage({ ...makeMessage("previous", id), nonce: "cccccccccccc3333" }, id)).toBeNull();
    expect(parseParentMessage(makeMessage("previous", id), id)).toBeNull();
    expect(parseChildMessage({ ...makeMessage("next", id), v: 2 }, id)).toBeNull();
    expect(parseChildMessage({ ...makeMessage("next", id), nonce: "cccccccccccc3333" }, id)).toBeNull();
    expect(parseChildMessage({ ...makeMessage("next", id), gameId: "sofa" }, id)).toBeNull();
    expect(parseChildMessage(makeMessage("activate", id), id)).toBeNull();
    expect(parseParentMessage(makeMessage("activate", id), id)?.type).toBe("activate");
    expect(parseParentMessage(makeMessage("next", id), id)).toBeNull();
    expect(parseParentMessage("activate", id)).toBeNull();
  });

  it("location hrefs must stay on the game's own fixed path with known fields", () => {
    const robot = publicGameById("robot")!;
    expect(isGameRelativeHref(robot, "/robot?band=4&s=123&from=commons")).toBe(true);
    expect(isGameRelativeHref(robot, "/sofa?band=4")).toBe(false);
    expect(isGameRelativeHref(robot, "//evil.example/robot")).toBe(false);
    expect(isGameRelativeHref(robot, "https://evil.example/robot")).toBe(false);
    expect(isGameRelativeHref(robot, "/robot?next=https://evil.example")).toBe(false);
    const sudoku = publicGameById("sudoku")!;
    expect(isGameRelativeHref(sudoku, "/play?t=pattern&band=3")).toBe(false);
    expect(parseChildMessage(makeMessage("location", id, { href: "/sofa" }), id)).toBeNull();
  });

  it("level keys l/lv/lvl/level allow levels 1–2; a legacy 3 is normalized to 2; nothing else loosens", () => {
    const robot = publicGameById("robot")!;
    for (const key of ["l", "lv", "lvl", "level"]) {
      expect(normalizeGameHref(robot, `/robot?band=4&s=1&${key}=1`)).toBe(`/robot?band=4&s=1&${key}=1`);
      expect(normalizeGameHref(robot, `/robot?band=4&s=1&${key}=2`)).toBe(`/robot?band=4&s=1&${key}=2`);
      expect(normalizeGameHref(robot, `/robot?band=4&s=1&${key}=3`)).toBe(`/robot?band=4&s=1&${key}=2`);
      for (const bad of ["0", "4", "02", "2.0", "https%3A%2F%2Fevil.app", ""]) expect(isGameRelativeHref(robot, `/robot?${key}=${bad}`)).toBe(false);
      expect(isGameRelativeHref(robot, `/robot?${key}=1&${key}=2`)).toBe(false);
    }
    for (const near of ["levels", "Level", "lvl2", "lev"]) expect(isGameRelativeHref(robot, `/robot?${near}=2`)).toBe(false);
    expect(normalizeGameHref(robot, "/sofa?lvl=2")).toBeNull();
    const sudoku = publicGameById("sudoku")!;
    expect(isGameRelativeHref(sudoku, "/play?t=sudoku&lv=2")).toBe(true);
    expect(isGameRelativeHref(sudoku, "/play?lv=2")).toBe(false);
    expect(parseChildMessage(makeMessage("location", id, { href: "/robot?band=4&s=7&lvl=3" }), id)?.href).toBe("/robot?band=4&s=7&lvl=2");
    // A stored legacy level-3 location resumes at level 2 on the registered origin.
    const resumed = new URL(buildLaunchUrl({ origin: "https://robot.example.app", game: robot, band: 4, identity: id, phase: "active", seed: 1, resumeHref: "/robot?band=4&s=7&l=3" }));
    expect(resumed.origin).toBe("https://robot.example.app");
    expect(resumed.searchParams.get("l")).toBe("2");
    expect(resumed.searchParams.get("s")).toBe("7");
    // An unsafe stored href never becomes the base; the fixed fresh launch is used instead.
    const unsafe = new URL(buildLaunchUrl({ origin: "https://sudoku.example.app", game: sudoku, band: 3, identity: { ...id, gameId: "sudoku" }, phase: "active", seed: 9, resumeHref: "/play?t=pattern&lvl=2" }));
    expect(unsafe.searchParams.get("t")).toBe("sudoku");
    expect(unsafe.searchParams.get("lvl")).toBeNull();
  });

  it("launch URLs use only the registered origin, fixed path, band, a fresh seed and the identity", () => {
    const sudoku = publicGameById("sudoku")!;
    const url = new URL(buildLaunchUrl({ origin: "https://sudoku.example.app", game: sudoku, band: 3, identity: { ...id, gameId: "sudoku" }, phase: "prepare", seed: 42 }));
    expect(url.origin).toBe("https://sudoku.example.app");
    expect(url.pathname).toBe("/play");
    expect(Object.fromEntries(url.searchParams)).toEqual({ t: "sudoku", band: "3", s: "42", from: "commons", host_session: id.session, host_nonce: id.nonce, host_game: "sudoku", host_phase: "prepare" });
    expect(readLaunchIdentity(url.search)).toEqual({ ...id, gameId: "sudoku", phase: "prepare" });
    expect(readLaunchIdentity("?host_session=x&host_nonce=y&host_game=robot&host_phase=active")).toBeNull();
    expect(readLaunchIdentity(`?host_session=${id.session}&host_nonce=${id.nonce}&host_game=pattern&host_phase=active`)).toBeNull();
  });

  it("dev parent origins must be exact HTTPS origins", () => {
    expect(exactHttpsOrigin("https://a.lovable.app")).toBe("https://a.lovable.app");
    expect(exactHttpsOrigin("http://a.lovable.app")).toBeUndefined();
    expect(exactHttpsOrigin("https://a.lovable.app/path")).toBeUndefined();
    expect(devParentOrigins("https://a.example.app, *, https://b.example.app/x")).toEqual(["https://a.example.app"]);
  });
});

describe("allowed hub parents", () => {
  it("are the canonical hub plus exactly the two approved QA previews", () => {
    expect(allowedParentOrigins("https://robot-host.lovable.app").sort()).toEqual([
      "https://aylas-puzzles.lovable.app",
      "https://id-preview-11--f6472ef2-e352-4eea-bebd-b2ca3e651718.lovable.app",
      "https://id-preview-4--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app",
    ].concat(allowedParentOrigins("x").includes("x") ? ["https://robot-host.lovable.app"] : []).sort());
    expect(allowedParentOrigins("https://robot-host.lovable.app")).not.toContain("https://id-preview--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app");
  });
});
