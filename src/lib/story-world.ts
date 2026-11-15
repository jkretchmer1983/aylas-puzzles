import type { PuzzleSpec } from "@/gen/types";

export type FrozenStory = { title: string; story: string; imagePrompt: string };
export const STORY_WAIT_MS = 9000;
export const ART_WAIT_MS = 8000;

export function storyWorldKey(band: number, template: string, seed: number) {
  return `story-world:v1:${band}:${template}:${seed}`;
}

export function storyWorldTier(band: number) {
  return band <= 2 ? "picturebook" : band <= 4 ? "adventure" : "expedition";
}

/** Only frozen narrative enters artwork; task, visual clues and answers never do. */
export function fullWorldPrompt(story: FrozenStory, band: number) {
  const style = band <= 2
    ? "Bold vivid picturebook gouache, round playful characters, bright coral turquoise and yellow, chunky forms"
    : band <= 4
      ? "Rich whimsical illustrated adventure, jewel colors, expressive characters, intricate painterly textures"
      : "Sophisticated magical illustrated expedition, sharp silhouettes, restrained ornament, jade vermilion and gold";
  return `${style}. Full-bleed immersive world, not a header. Characters and story details at perimeter, calm central play space. Responsive portrait/landscape cropping: keep subjects inside outer thirds, paint every edge. No text, letters, numbers, grids, clues or solutions. Frozen story: ${story.title}. ${story.story}. Artist scene: ${story.imagePrompt}`.slice(0, 1490);
}

export function generatorStory(spec: Pick<PuzzleSpec, "title" | "story">): FrozenStory {
  return { title: spec.title, story: spec.story, imagePrompt: "Illustrate this story without depicting a solution." };
}