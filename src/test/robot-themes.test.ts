import { beforeEach, describe, expect, it } from "vitest";
import { robotBinding } from "@/robot/themes";

 describe("Robot instance content", () => {
  beforeEach(() => sessionStorage.clear());
  it("is stable for a resumed instance", () => {
    const first = robotBinding(1234, 4);
    expect(robotBinding(1234, 4)).toEqual(first);
  });
  it("rotates coordinated themes for fresh instances", () => {
    const first = robotBinding(1234, 4);
    const second = robotBinding(5678, 4);
    expect(second.themeId).not.toBe(first.themeId);
    expect(second.story.length).toBeGreaterThan(30);
    expect(second.subjects.every(s => s.parcel && s.destination && s.icon)).toBe(true);
  });
});
