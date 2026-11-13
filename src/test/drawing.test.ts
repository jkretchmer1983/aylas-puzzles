import { describe, expect, it } from "vitest";
import { DRAWING_THEMES, drawingFor, imagePrompt } from "@/gen/drawing";
import { TEMPLATES } from "@/gen/templates";

describe("instant puzzle drawings", () => {
  it("gives all 20 puzzle types their own drawing theme", () => {
    expect(Object.keys(DRAWING_THEMES).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
    expect(new Set(Object.values(DRAWING_THEMES)).size).toBe(20);
  });

  it("keeps the drawing stable for a puzzle and changes decoration on replay", () => {
    expect(drawingFor("nim", 42)).toEqual(drawingFor("nim", 42));
    expect(drawingFor("nim", 43)).not.toEqual(drawingFor("nim", 42));
    expect(drawingFor("nim", 43).theme).toBe("robot");
  });

  it("builds the AI picture prompt from title and story only, with no text in the image", () => {
    const p = imagePrompt("Robot Race", "A rusty robot guards ten shiny stones.", 5);
    expect(p).toContain("Robot Race");
    expect(p).toContain("rusty robot");
    expect(p).toContain("no text");
    expect(p).not.toContain("answer");
    expect(imagePrompt("A", "B", 0)).not.toBe(imagePrompt("A", "B", 6));
  });
});