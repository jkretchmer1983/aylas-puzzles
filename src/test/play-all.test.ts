import { beforeEach, describe, expect, it } from "vitest";
import { dealPlayAllGame, playAllNote, readPlayAllDeck, resumePlayAllGame } from "@/lib/play-all";
import { readMenuReturn, readPreferredBand, saveMenuReturn, savePreferredBand } from "@/lib/menu-state";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("Play All deck", () => {
  it("deals every eligible new game before repeating", () => {
    const ids = ["sudoku", "pattern", "take"];
    const first = dealPlayAllGame(2, ids, undefined, () => 0)!;
    const second = dealPlayAllGame(2, ids, first.id, () => 0)!;
    const third = dealPlayAllGame(2, ids, second.id, () => 0)!;
    expect([first.id, second.id, third.id]).toEqual(["sudoku", "pattern", "take"]);
    const nextCycle = dealPlayAllGame(2, ids, third.id, () => 0)!;
    expect(nextCycle.id).toBe("sudoku");
    expect(nextCycle.seen).toEqual(["sudoku"]);
  });

  it("handles zero and one eligible game without getting trapped", () => {
    expect(dealPlayAllGame(1, [])).toBeUndefined();
    expect(dealPlayAllGame(1, ["pattern"], "pattern", () => 0)?.id).toBe("pattern");
    expect(dealPlayAllGame(1, ["pattern"], "pattern", () => 0)?.id).toBe("pattern");
  });

  it("reconciles removed games and keeps a refreshed current game dealt", () => {
    resumePlayAllGame(3, ["sudoku", "pattern"], "pattern");
    expect(readPlayAllDeck(3, ["sudoku"]).seen).toEqual([]);
    resumePlayAllGame(3, ["sudoku"], "sudoku");
    expect(readPlayAllDeck(3, ["sudoku"]).seen).toEqual(["sudoku"]);
  });
});

describe("Puzzle Commons device state", () => {
  it("persists the selected band and menu scroll", () => {
    savePreferredBand(4);
    saveMenuReturn(4, 827.6);
    expect(readPreferredBand()).toBe(4);
    expect(readMenuReturn()).toEqual({ band: 4, scrollY: 828 });
  });

  it("ignores invalid saved values", () => {
    savePreferredBand(0);
    expect(readPreferredBand()).toBeUndefined();
    sessionStorage.setItem("ayla-commons-return-v1", JSON.stringify({ band: 9, scrollY: -4 }));
    expect(readMenuReturn()).toBeUndefined();
  });
});

describe("Play All wording", () => {
  it("describes one eligible game as a fresh puzzle of that game, not a mix", () => {
    const one = playAllNote([{ name: "Forest Sudoku" }], { min: 9, max: 10 });
    expect(one).toContain("fresh Forest Sudoku puzzle");
    expect(one).not.toMatch(/mix/i);
    expect(playAllNote([{ name: "A" }, { name: "B" }], { min: 4, max: 5 })).toMatch(/mix of 2/);
    expect(playAllNote([], { min: 4, max: 5 })).not.toMatch(/mix/i);
  });
});
