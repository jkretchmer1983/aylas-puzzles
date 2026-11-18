import { describe, expect, it } from "vitest";
import { buildLaunchUrl, isGameRelativeHref, makeMessage, parseChildMessage, parseParentMessage, readLaunchIdentity } from "@/host/protocol";
import { publicGameById } from "@/host/public-games";
import { allowedParentOrigins, devParentOrigins, exactHttpsOrigin } from "@/host/origins";

const id = { session: "aaaaaaaaaaaa1111", nonce: "bbbbbbbbbbbb2222", gameId: "robot" };

describe("hub ⇄ game protocol", () => {
  it("accepts only exact protocol, version and identity", () => {
    expect(parseChildMessage(makeMessage("next", id), id)?.type).toBe("next");
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
