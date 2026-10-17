import { useCallback, useEffect, useState } from "react";

export type Progress = { band: number | null; solved: number; streak: number; best: number };
const KEY = "puzzle-quest.progress";
const empty: Progress = { band: null, solved: 0, streak: 0, best: 0 };

export function readProgress(): Progress {
  if (typeof window === "undefined") return empty;
  try { return { ...empty, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Progress>) }; } catch { return empty; }
}

export function useProgress() {
  const [p, setP] = useState<Progress>(empty);
  useEffect(() => setP(readProgress()), []);
  const update = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(readProgress());
    localStorage.setItem(KEY, JSON.stringify(next));
    setP(next);
  }, []);
  return [p, update] as const;
}

export const tierFor = (band: number) => (band <= 1 ? "little" : band <= 4 ? "mid" : "big");
