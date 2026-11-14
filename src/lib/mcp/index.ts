import { defineMcp } from "@lovable.dev/mcp-js";
import listPuzzleTypes from "./tools/list-puzzle-types";
import getPuzzle from "./tools/get-puzzle";
import checkAnswer from "./tools/check-answer";

export default defineMcp({
  name: "aylas-puzzles",
  title: "Aylas Puzzles",
  version: "0.1.0",
  instructions: "Kids' logic puzzles for ages 3-10. List types, get a puzzle (story, task, hint), then check the child's answer with the same age, type and seed. Answers are never revealed.",
  tools: [listPuzzleTypes, getPuzzle, checkAnswer],
});
