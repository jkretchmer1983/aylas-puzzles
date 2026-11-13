import { makeRng } from "./rng";

/** Illustration decoration uses its own seed and never reads puzzle answers. */
export const DRAWING_THEMES = {
  count: "garden", pattern: "beads", odd: "magnifier", add: "basket",
  take: "bird", size: "trees", sequence: "trail", sudoku: "tiles",
  lineup: "houses", coins: "treasure", sides: "shapes", balance: "scales",
  magic: "wizard", nim: "robot", compare: "crocodile", clock: "clocktower",
  evenodd: "detective", groups: "gifts", cipher: "lock", riddle: "crystal",
  position: "houses", colors: "beads", shapepick: "shapes", double: "magnifier", share: "gifts",
  missing: "detective", days: "clocktower", legs: "garden", change: "treasure", fraction: "basket",
} as const;

export type DrawingTheme = (typeof DRAWING_THEMES)[keyof typeof DRAWING_THEMES];

const PROMPT_STYLES = [
  "cute chunky toddler cartoon, very thick rounded outlines, bright primary colors, big soft cuddly shapes",
  "cheerful preschool picture-book illustration, rounded shapes, candy colors, smiling characters",
  "colorful storybook illustration, playful shapes, warm palette, gentle crayon texture",
  "detailed storybook adventure illustration, richer colors, painterly texture, sense of wonder",
  "vibrant animated-film concept art, dynamic composition, expressive characters, cinematic lighting",
  "sleek modern adventure illustration, bold confident shapes, moody cinematic lighting, older-kid appeal",
  "stylish graphic-novel illustration, dramatic lighting, sophisticated palette, cool and grown-up for a 10 year old",
] as const;

/** Rich AI scene art built only from the puzzle's title and story — never its task or answers. */
export function imagePrompt(title: string, story: string, band: number): string {
  const style = PROMPT_STYLES[Math.min(Math.max(band, 0), PROMPT_STYLES.length - 1)];
  return `${style}. Whimsical scene for a kids puzzle called "${title}": ${story} Absolutely no text, words, letters, or numbers anywhere in the image.`;
}

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