export type ShapeName = "circle" | "square" | "triangle" | "star" | "pentagon" | "hexagon";

export type Visual =
  | { type: "rows"; rows: string[][]; big?: boolean }
  | { type: "clock"; h: number; m: number }
  | { type: "coins"; coins: number[] }
  | { type: "shapes"; shapes: ShapeName[] }
  | { type: "equations"; lines: string[] }
  | { type: "magic"; grid: (number | null)[] };

export type Kind =
  | { type: "choice"; options: string[]; answer: number; bigOptions?: boolean }
  | { type: "number"; answer: number }
  | { type: "order"; items: string[]; answer: string[]; first: string; last: string }
  | { type: "sudoku"; symbols: string[]; given: (number | null)[]; solution: number[] }
  | { type: "nim"; stones: number; maxTake: number; icon: string };

export type PuzzleSpec = {
  template: string;
  /** Short neutral title used offline and as an AI hint. */
  title: string;
  /** Offline story line. Must not reveal the answer. */
  story: string;
  /** Exact question — never rewritten by the AI so the answer always matches. */
  task: string;
  hint: string;
  /** Plain-language summary for the AI storyteller. */
  theme: string;
  /** Emojis that decorate and animate the scene. */
  scene: string[];
  visual?: Visual;
  kind: Kind;
};

export type Band = { id: number; label: string; min: number; max: number };
