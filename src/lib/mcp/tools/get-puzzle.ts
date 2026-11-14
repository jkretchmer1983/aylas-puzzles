import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { makePuzzle, publicPuzzle } from "../puzzles";

export default defineTool({
  name: "get_puzzle",
  title: "Get a puzzle",
  description: "Make a puzzle for a child's age. The same seed always gives the same puzzle; the answer is not included.",
  inputSchema: {
    age: z.number().int().min(3).max(10).describe("Child's age, 3 to 10."),
    type: z.string().max(40).optional().describe("Puzzle type id from list_puzzle_types; omit for any."),
    seed: z.number().int().min(1).max(2_000_000_000).optional().describe("Seed for a repeatable puzzle; omit for a random one."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: ({ age, type, seed }) => {
    const s = seed ?? Math.floor(Math.random() * 2_000_000_000) + 1;
    const { band, template, spec } = makePuzzle(age, type, s);
    const p = publicPuzzle(spec);
    const link = `https://aylas-puzzles.lovable.app/play?band=${band.id}&t=${template.id}&s=${s}`;
    const text = `${p.title}\n${p.story}\n\n${p.task}${p.grid.length ? `\nGrid: ${p.grid.join(" ")}` : ""}${p.options.length ? `\nPieces: ${p.options.join(", ")}` : ""}\n${p.howToAnswer}\nType: ${template.id}, seed: ${s}\nPlay: ${link}`;
    return { content: [{ type: "text", text }], structuredContent: { ...p, type: template.id, age, seed: s, link } };
  },
});
