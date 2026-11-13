import { writeStory } from "@/lib/story.functions";

// Rich AI storylines, fetched once per puzzle (and prefetched for the next one).
// Settles with the generator text on failure/timeout, so the loader never waits forever.
type Entry = { settled: boolean; title?: string; story?: string; subs: Set<() => void> };
const cache = new Map<string, Entry>();

export function ensureStory(key: string, input: { age: number; theme: string; title: string; story: string; task: string }): Entry {
  let e = cache.get(key);
  if (e) return e;
  const entry: Entry = { settled: false, subs: new Set() };
  cache.set(key, entry);
  const finish = (r?: { title: string; story: string }) => {
    if (entry.settled) return;
    if (r) { entry.title = r.title; entry.story = r.story; }
    entry.settled = true;
    entry.subs.forEach((f) => f());
  };
  const timer = setTimeout(() => finish(), 9000);
  if (typeof navigator !== "undefined" && !navigator.onLine) finish();
  else writeStory({ data: input }).then((r) => finish(r.ok ? r : undefined), () => finish()).finally(() => clearTimeout(timer));
  return entry;
}

export function subscribeStory(key: string, f: () => void) {
  const e = cache.get(key);
  e?.subs.add(f);
  return () => { e?.subs.delete(f); };
}
