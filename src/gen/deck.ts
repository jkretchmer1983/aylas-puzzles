/** Deals puzzle types like a shuffled deck: every type plays once before any repeats. */
export function nextFromDeck(ids: string[], seen: string[], exclude: string | undefined, rand: () => number = Math.random) {
  let left = ids.filter((id) => !seen.includes(id) && id !== exclude);
  let used = seen.filter((id) => ids.includes(id));
  if (!left.length) { used = []; left = ids.filter((id) => id !== exclude); }
  const id = left[Math.floor(rand() * left.length)] ?? ids[0]!;
  return { id, seen: [...used, id] };
}

export function drawTemplate(band: number, ids: string[], exclude?: string) {
  const key = `pq-deck-${band}`;
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { /* fresh deck */ }
  const next = nextFromDeck(ids, Array.isArray(seen) ? seen : [], exclude);
  try { localStorage.setItem(key, JSON.stringify(next.seen)); } catch { /* storage unavailable */ }
  return next.id;
}
