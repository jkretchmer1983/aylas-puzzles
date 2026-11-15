import { writeStory, type StoryResult } from "@/lib/story.functions";
import { streamImage } from "@/lib/stream-image";
import type { PuzzleSpec } from "@/gen/types";
import { BANDS } from "@/gen/templates";
import { fullWorldPrompt, generatorStory, STORY_WAIT_MS, type FrozenStory } from "./story-world";

type StoryWriter = (input: Parameters<typeof writeStory>[0]) => Promise<StoryResult>;
type Painter = (prompt: string, onFrame: (src: string, final: boolean) => void) => Promise<void>;
export type WorldEntry = {
  frozen: FrozenStory | null;
  src: string | null;
  final: boolean;
  settled: boolean;
  error?: string;
  listeners: Set<() => void>;
};

/** Separate from /play: header artwork can never satisfy a full-world request. */
export function createWorldCache(
  writer: StoryWriter = writeStory,
  painter: Painter = (prompt, frame) => streamImage("/api/generate-image", { prompt }, frame),
) {
  const entries = new Map<string, WorldEntry>();
  return {
    ensure(key: string, spec: PuzzleSpec, band: number, offline: boolean, keepKey?: string): WorldEntry {
      const cached = entries.get(key);
      if (cached) return cached;
      const entry: WorldEntry = { frozen: null, src: null, final: false, settled: false, listeners: new Set() };
      entries.set(key, entry);
      for (const k of entries.keys()) if (k !== key && k !== keepKey) entries.delete(k);
      const notify = () => entry.listeners.forEach((fn) => fn());
      const paint = (story: FrozenStory) => {
        if (offline) { entry.settled = true; notify(); return; }
        painter(fullWorldPrompt(story, band), (src, final) => {
          entry.src = src; entry.final = final; notify();
        }).then(() => {
          entry.settled = true; notify();
        }, (error: unknown) => {
          entry.src = null; entry.final = false; entry.settled = true;
          entry.error = error instanceof Error ? error.message : "The illustration is unavailable.";
          notify();
        });
      };
      const freeze = (result?: StoryResult) => {
        if (entry.frozen) return;
        entry.frozen = result?.ok ? { title: result.title, story: result.story, imagePrompt: result.imagePrompt } : generatorStory(spec);
        if (result && !result.ok) entry.error = result.error;
        notify();
        paint(entry.frozen);
      };
      if (offline) freeze();
      else {
        const timer = setTimeout(() => freeze(), STORY_WAIT_MS);
        writer({ data: { age: BANDS[band]?.max ?? 6, theme: spec.theme, title: spec.title, story: spec.story, task: spec.task } })
          .then((result) => { clearTimeout(timer); freeze(result); }, () => { clearTimeout(timer); freeze(); });
      }
      return entry;
    },
  };
}

export const worldCache = createWorldCache();