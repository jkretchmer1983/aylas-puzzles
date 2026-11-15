/** Browser-session presentation state; generated answers remain owned by Renderer. */
export type PuzzleSession = { started?: boolean; boardSeed?: number; cells?: (number | null)[]; result?: boolean; awarded?: boolean };
const memory = new Map<string, PuzzleSession>();
export function readPuzzleSession(key: string): PuzzleSession {
  if (typeof window === 'undefined') return {};
  if (!memory.has(key)) {
    try { memory.set(key, JSON.parse(sessionStorage.getItem(`forest-puzzle:${key}`) || '{}')); }
    catch { memory.set(key, {}); }
  }
  return memory.get(key) ?? {};
}
export function savePuzzleSession(key: string, patch: PuzzleSession) {
  const next = { ...readPuzzleSession(key), ...patch };
  memory.set(key, next);
  try { sessionStorage.setItem(`forest-puzzle:${key}`, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}
