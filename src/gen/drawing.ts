import { makeRng } from "./rng";

/** Illustration decoration uses its own seed and never reads puzzle answers. */
export const DRAWING_THEMES = {
  count: "garden", pattern: "beads", odd: "magnifier", add: "basket",
  take: "bird", size: "trees", sequence: "trail", sudoku: "tiles",
  lineup: "houses", coins: "treasure", sides: "shapes", balance: "scales",
  magic: "wizard", nim: "robot", compare: "crocodile", clock: "clocktower",
  evenodd: "detective", groups: "gifts", cipher: "lock", riddle: "crystal",
} as const;

export type DrawingTheme = (typeof DRAWING_THEMES)[keyof typeof DRAWING_THEMES];

export function drawingFor(template: string, seed: number) {
  const rng = makeRng(seed ^ 0x5f3759df);
  const theme = DRAWING_THEMES[template as keyof typeof DRAWING_THEMES] ?? "crystal";
  return {
    theme,
    tilt: rng.int(-8, 8),
    variant: rng.int(0, 2),
    sparks: Array.from({ length: 7 }, () => ({ x: rng.int(20, 780), y: rng.int(15, 155), size: rng.int(3, 7) })),
  };
}