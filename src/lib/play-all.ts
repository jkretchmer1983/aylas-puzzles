import { nextFromDeck } from "@/gen/deck";

const DECK_KEY = "ayla-commons-play-all-v1";
export type PlayAllDeck = { band: number; eligible: string[]; seen: string[] };

function storageKey(band: number) { return `${DECK_KEY}:${band}`; }

export function readPlayAllDeck(band: number, eligible: string[]): PlayAllDeck {
  const clean = { band, eligible: [...eligible], seen: [] as string[] };
  if (typeof window === "undefined" || eligible.length === 0) return clean;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(band)) ?? "null");
    if (!value || typeof value !== "object") return clean;
    const saved = value as Record<string, unknown>;
    if (saved.band !== band || !Array.isArray(saved.seen)) return clean;
    return { ...clean, seen: saved.seen.filter((id): id is string => typeof id === "string" && eligible.includes(id)) };
  } catch {
    return clean;
  }
}

export function dealPlayAllGame(
  band: number,
  eligible: string[],
  currentId?: string,
  rand: () => number = Math.random,
): PlayAllDeck & { id: string } | undefined {
  if (eligible.length === 0) return undefined;
  const deck = readPlayAllDeck(band, eligible);
  const next = nextFromDeck(eligible, deck.seen, currentId, rand);
  const value = { ...deck, id: next.id, seen: next.seen };
  if (typeof window !== "undefined") {
    try { localStorage.setItem(storageKey(band), JSON.stringify({ band, eligible, seen: next.seen })); } catch { /* Play continues without persistence. */ }
  }
  return value;
}

/** Refreshing an explicit Play All URL keeps its current game in the dealt set. */
export function resumePlayAllGame(band: number, eligible: string[], currentId: string) {
  if (!eligible.includes(currentId)) return;
  const deck = readPlayAllDeck(band, eligible);
  const seen = deck.seen.includes(currentId) ? deck.seen : [...deck.seen, currentId];
  try { localStorage.setItem(storageKey(band), JSON.stringify({ band, eligible, seen })); } catch { /* Storage is optional. */ }
}

/** Honest Play All copy: one eligible game is a fresh puzzle of that game, not a mix. */
export function playAllNote(playable: readonly { name: string }[], band: { min: number; max: number }) {
  if (playable.length === 0) return "New adventures for this age are arriving soon.";
  if (playable.length === 1) return `Only one adventure is ready for ages ${band.min}–${band.max}: starts a fresh ${playable[0]!.name} puzzle.`;
  return `A surprise mix of ${playable.length} adventures for ages ${band.min}–${band.max}.`;
}
