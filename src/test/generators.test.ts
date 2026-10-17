import { describe, expect, it } from "vitest";
import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";

describe("puzzle generators", () => {
  it("has 20 templates and overlapping age bands from 3–4 up to 9–10", () => {
    expect(TEMPLATES).toHaveLength(20);
    expect(BANDS.map((b) => b.label)).toEqual(["Ages 3–4", "Ages 4–5", "Ages 5–6", "Ages 6–7", "Ages 7–8", "Ages 8–9", "Ages 9–10"]);
  });

  it("every band offers several puzzle types", () => {
    for (const b of BANDS) expect(templatesFor(b.id).length).toBeGreaterThanOrEqual(7);
  });

  it("generates solvable puzzles with a valid answer", () => {
    for (const b of BANDS) for (const t of templatesFor(b.id)) for (let s = 1; s < 60; s++) {
      const p = generate(t.id, b.id, s * 7919);
      const k = p.kind;
      if (k.type === "choice") { expect(k.answer).toBeGreaterThanOrEqual(0); expect(new Set(k.options).size).toBe(k.options.length); }
      if (k.type === "number") expect(Number.isInteger(k.answer) && k.answer >= 0).toBe(true);
      if (k.type === "order") expect([...k.items].sort()).toEqual([...k.answer].sort());
      if (k.type === "nim") expect(k.stones % (k.maxTake + 1)).not.toBe(0);
      if (k.type === "sudoku") {
        for (let i = 0; i < 4; i++) {
          expect(new Set(k.solution.slice(i * 4, i * 4 + 4)).size).toBe(4);
          expect(new Set([0, 1, 2, 3].map((r) => k.solution[r * 4 + i])).size).toBe(4);
        }
      }
    }
  });

  it("the same seed rebuilds the same puzzle, a new seed changes it", () => {
    expect(generate("add", 3, 42)).toEqual(generate("add", 3, 42));
    expect(generate("add", 3, 42).task).not.toEqual(generate("add", 3, 43).task);
  });
});
