import { describe, expect, it } from "vitest";
import { sceneShift, SCENE_OVERSCAN, SCENE_TRAVEL_MIN } from "@/lib/scene-parallax";

describe("courtyard parallax", () => {
  it("starts at 0 and ends at exactly the full travel at the bottom of any page length", () => {
    expect(SCENE_OVERSCAN).toBe(400);
    expect(sceneShift(0, 5000, 1000)).toBe(0);
    expect(sceneShift(4000, 5000, 1000)).toBe(400);
    expect(sceneShift(9000, 10000, 1000)).toBe(400);
  });
  it("moves proportionally to progress and never past its bounds", () => {
    expect(sceneShift(2000, 5000, 1000)).toBe(200);
    expect(sceneShift(-50, 5000, 1000)).toBe(0);
    expect(sceneShift(6000, 5000, 1000)).toBe(400);
  });
  it("uses the remaining travel when part of the overscan lifts the characters (never below 250px)", () => {
    expect(SCENE_TRAVEL_MIN).toBe(250);
    expect(sceneShift(4000, 5000, 1000, 279)).toBe(279);
    expect(sceneShift(2000, 5000, 1000, 250)).toBe(125);
  });
  it("stays still on a page that does not scroll", () => {
    expect(sceneShift(0, 800, 1000)).toBe(0);
  });
});
