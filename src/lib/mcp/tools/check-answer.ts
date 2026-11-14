import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { checkAnswer, makePuzzle } from "../puzzles";

export default defineTool({
  name: "check_answer",
  title: "Check an answer",
  description: "Check a child's answer to a puzzle from get_puzzle, using its age, type and seed.",
  inputSchema: {
    age: z.number().int().min(3).max(10).describe("Age used in get_puzzle."),
    type: z.string().max(40).describe("Puzzle type returned by get_puzzle."),
    seed: z.number().int().min(1).max(2_000_000_000).describe("Seed returned by get_puzzle."),
    answer: z.string().min(1).max(300).describe("The answer, in the format get_puzzle described."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ age, type, seed, answer }) => {
    const { spec } = makePuzzle(age, type, seed);
    const correct = checkAnswer(spec, answer);
    return { content: [{ type: "text", text: correct ? "Correct! 🎉" : `Not quite. Hint: ${spec.hint}` }], structuredContent: { correct } };
  },
});
