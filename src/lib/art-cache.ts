import { streamImage } from "@/lib/stream-image";

/**
 * Scene pictures are painted in the background and shared across puzzles:
 * while a kid solves one puzzle, the next puzzle's picture is already streaming.
 * Entries are keyed by the puzzle's band-template-seed key.
 */
export type ArtEntry = {
  src: string | null;
  final: boolean;
  settled: boolean;
  listeners: Set<() => void>;
};

const cache = new Map<string, ArtEntry>();

function notify(entry: ArtEntry) {
  entry.listeners.forEach((cb) => cb());
}

/** Start painting a picture if it isn't already underway, and return its entry. */
export function ensureArt(key: string, prompt: string, keepKey?: string): ArtEntry {
  const existing = cache.get(key);
  if (existing) return existing;
  const entry: ArtEntry = { src: null, final: false, settled: false, listeners: new Set() };
  cache.set(key, entry);
  // Keep only the puzzle being played and the one coming next.
  for (const k of cache.keys()) if (k !== key && k !== keepKey) cache.delete(k);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    entry.settled = true;
    return entry;
  }
  streamImage("/api/generate-image", { prompt }, (dataUrl, isFinal) => {
    entry.src = dataUrl;
    entry.final = isFinal;
    if (isFinal) entry.settled = true;
    notify(entry);
  }).catch(() => {
    entry.settled = true;
    notify(entry);
  });
  return entry;
}

export function subscribeArt(key: string, cb: () => void): () => void {
  const entry = cache.get(key);
  if (!entry) return () => {};
  entry.listeners.add(cb);
  return () => entry.listeners.delete(cb);
}
