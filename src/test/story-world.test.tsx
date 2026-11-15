import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorldCache } from "@/lib/story-world-cache";
import { fullWorldPrompt, storyWorldKey, storyWorldTier, STORY_WAIT_MS } from "@/lib/story-world";
import { BANDS, generate, templatesFor } from "@/gen/templates";
import { PuzzleBody } from "@/gen/Renderer";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Story Worlds preserves puzzle truth", () => {
  it("paints the exact frozen AI story and writer image prompt, not the generator intro", async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, title: "Moon garden", story: "Fox found a moonlit garden.", imagePrompt: "A fox beneath silver flowers" });
    const painter = vi.fn().mockResolvedValue(undefined);
    const cache = createWorldCache(writer, painter);
    const entry = cache.ensure(storyWorldKey(3, "add", 42), generate("add", 3, 42), 3, false);
    expect(painter).not.toHaveBeenCalled();
    await Promise.resolve(); await Promise.resolve();
    expect(entry.frozen?.story).toBe("Fox found a moonlit garden.");
    expect(painter.mock.calls[0]?.[0]).toContain("Fox found a moonlit garden.");
    expect(painter.mock.calls[0]?.[0]).toContain("A fox beneath silver flowers");
    expect(painter.mock.calls[0]?.[0]).not.toContain(generate("add", 3, 42).task);
  });
  it("freezes the generator fallback after nine seconds and never replaces it with a late story", async () => {
    vi.useFakeTimers();
    let resolve: (r: { ok: true; title: string; story: string; imagePrompt: string }) => void = () => {};
    const writer = vi.fn(() => new Promise<{ ok: true; title: string; story: string; imagePrompt: string }>((r) => { resolve = r; }));
    const painter = vi.fn().mockResolvedValue(undefined);
    const spec = generate("add", 3, 42);
    const entry = createWorldCache(writer, painter).ensure("timeout", spec, 3, false);
    await vi.advanceTimersByTimeAsync(STORY_WAIT_MS);
    expect(entry.frozen?.story).toBe(spec.story);
    resolve({ ok: true, title: "Late", story: "Late narrative", imagePrompt: "Late art" });
    await Promise.resolve();
    expect(entry.frozen?.story).toBe(spec.story);
    expect(painter).toHaveBeenCalledTimes(1);
  });
  it("offline play makes no AI requests", () => {
    const writer = vi.fn(), painter = vi.fn();
    const entry = createWorldCache(writer, painter).ensure("offline", generate("count", 0, 42), 0, true);
    expect(entry.settled).toBe(true);
    expect(writer).not.toHaveBeenCalled(); expect(painter).not.toHaveBeenCalled();
  });
  it("failed painting clears partial frames and settles without retry", async () => {
    const painter = vi.fn(async (_prompt, frame) => { frame("partial", false); throw new Error("Safe illustration error"); });
    const writer = vi.fn().mockResolvedValue({ ok: true, title: "Story", story: "Intro", imagePrompt: "Scene" });
    const entry = createWorldCache(writer, painter).ensure("failure", generate("add", 3, 42), 3, false);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(entry.error).toBe("Safe illustration error"); expect(entry.src).toBeNull();
    expect(entry.settled).toBe(true); expect(painter).toHaveBeenCalledTimes(1);
  });
  it("namespaces art independently of the tree cache", () => {
    expect(storyWorldKey(3, "sudoku", 42)).toBe("story-world:v1:3:sudoku:42");
    expect(storyWorldKey(3, "sudoku", 42)).not.toBe("3-sudoku-42");
  });
  it("maps existing seven bands into the three requested art directions", () => {
    expect(BANDS.map((b) => storyWorldTier(b.id))).toEqual(["picturebook", "picturebook", "picturebook", "adventure", "adventure", "expedition", "expedition"]);
  });
  it("prompts never use private task or answer data", () => {
    const prompt = fullWorldPrompt({ title: "Fox", story: "A bright garden", imagePrompt: "Flowers" }, 0);
    expect(prompt).toContain("No text, letters, numbers, grids, clues or solutions");
    expect(prompt).toContain("calm central play space");
  });
  it("all available template/band combinations render using the existing renderer", () => {
    const report = vi.fn();
    for (const band of BANDS) for (const template of templatesFor(band.id)) {
      const view = render(<PuzzleBody spec={generate(template.id, band.id, 42)} report={report} storyWorld />);
      expect(view.container.querySelector("[data-template]")?.getAttribute("data-template")).toBe(template.id);
      view.unmount();
    }
  });
  it("choice selection does not disclose correctness until check", () => {
    const spec = generate("odd", 0, 42), report = vi.fn();
    if (spec.kind.type !== "choice") throw new Error("Expected choice");
    render(<PuzzleBody spec={spec} report={report} storyWorld />);
    fireEvent.click(screen.getByRole("button", { name: spec.kind.options[spec.kind.answer] }));
    expect(report).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check my answer ✓" }));
    expect(report).toHaveBeenCalledWith(true);
  });
  it("Sudoku fixed clues remain immutable and every seeded solution checks correctly", () => {
    const spec = generate("sudoku", 5, 42), report = vi.fn();
    if (spec.kind.type !== "sudoku") throw new Error("Expected sudoku");
    const k = spec.kind;
    render(<PuzzleBody spec={spec} report={report} storyWorld />);
    k.given.forEach((v, i) => {
      const name = `Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}${v === null ? ", empty" : `, ${k.symbols[v]}`}`;
      const cell = screen.getByRole("button", { name });
      if (v !== null) expect(cell).toBeDisabled();
      else { fireEvent.click(cell); fireEvent.click(screen.getByRole("button", { name: k.symbols[k.solution[i] ?? 0] })); }
    });
    act(() => fireEvent.click(screen.getByRole("button", { name: "Check my answer ✓" })));
    expect(report).toHaveBeenCalledWith(true);
  });
});