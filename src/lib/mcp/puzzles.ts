import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";
import type { PuzzleSpec } from "@/gen/types";
import { ToolError } from "@lovable.dev/mcp-js";

export function bandForAge(age: number) {
  const b = BANDS.find((x) => age >= x.min && age <= x.max);
  if (!b) throw new ToolError("Age must be between 3 and 10.");
  return b;
}

export function makePuzzle(age: number, type: string | undefined, seed: number) {
  const band = bandForAge(age);
  const ok = templatesFor(band.id);
  const t = type ? ok.find((x) => x.id === type) : ok[seed % ok.length];
  if (!t) throw new ToolError(`Unknown type for this age. Try: ${ok.map((x) => x.id).join(", ")}`);
  return { band, template: t, spec: generate(t.id, band.id, seed) };
}

/** Public description of the puzzle — never includes the answer. */
export function publicPuzzle(spec: PuzzleSpec) {
  const k = spec.kind;
  const answerFormat =
    k.type === "choice" ? { kind: "choice", options: k.options, howToAnswer: "Reply with one option exactly." } :
    k.type === "number" ? { kind: "number", options: [] as string[], howToAnswer: "Reply with a whole number." } :
    k.type === "order" ? { kind: "order", options: k.items, howToAnswer: `Reply with all items comma-separated, from ${k.first} to ${k.last}.` } :
    k.type === "sudoku" ? { kind: "sudoku", options: k.symbols, howToAnswer: "Reply with the full 4x4 grid as 16 comma-separated symbols, row by row." } :
    { kind: "game", options: [] as string[], howToAnswer: `Take-away game with ${k.stones} stones, take 1-${k.maxTake}; last to take wins. Play it in the app.` };
  const grid = k.type === "sudoku" ? k.given.map((g) => (g === null ? "_" : k.symbols[g] ?? "_")) : [];
  return { title: spec.title, story: spec.story, task: spec.task, hint: spec.hint, grid, ...answerFormat };
}

export function checkAnswer(spec: PuzzleSpec, raw: string): boolean {
  const k = spec.kind, a = raw.trim();
  const list = a.split(",").map((s) => s.trim()).filter(Boolean);
  if (k.type === "choice") return a === k.options[k.answer];
  if (k.type === "number") return /^-?\d+$/.test(a) && Number(a) === k.answer;
  if (k.type === "order") return list.length === k.answer.length && list.every((x, i) => x === k.answer[i]);
  if (k.type === "sudoku") return list.length === 16 && list.every((x, i) => x === k.symbols[k.solution[i]!]);
  throw new ToolError("This puzzle is a game — play it in the app.");
}

export const allTypes = () => TEMPLATES.map((t) => ({ id: t.id, name: t.name, minAge: BANDS[t.min]!.min, maxAge: BANDS[t.max]!.max }));
