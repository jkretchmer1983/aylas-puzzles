import { describe, expect, it } from "vitest";
import { parseRouteBand } from "@/lib/commons-launch";

describe("game links keep the menu age", () => {
  it("passes every valid menu band 1–6 through unchanged, whatever the game's own ages", () => {
    expect(parseRouteBand(3)).toBe(3); // airship is 1–2 only: the gate, not the parser, rejects it
    expect(parseRouteBand("1")).toBe(1); // robot is 4–6 only
    expect(parseRouteBand(2)).toBe(2); // seating is 3–6 only
    expect(parseRouteBand(6)).toBe(6);
  });
  it("defaults invalid values without clamping them into an eligible older band", () => {
    expect(parseRouteBand(0)).toBe(1);
    expect(parseRouteBand(9)).toBe(1);
    expect(parseRouteBand(2.5)).toBe(1);
    expect(parseRouteBand("x")).toBe(1);
  });
});
