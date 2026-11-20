const BAND_KEY = "ayla-commons-band-v1";
const RETURN_KEY = "ayla-commons-return-v1";

export function readPreferredBand(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const band = Number(localStorage.getItem(BAND_KEY));
    return Number.isInteger(band) && band >= 1 && band <= 6 ? band : undefined;
  } catch {
    return undefined;
  }
}

export function savePreferredBand(band: number) {
  if (typeof window === "undefined" || !Number.isInteger(band) || band < 1 || band > 6) return;
  try { localStorage.setItem(BAND_KEY, String(band)); } catch { /* Storage is optional. */ }
}

export type MenuReturnState = { band: number; scrollY: number };

export function saveMenuReturn(band: number, scrollY: number) {
  if (typeof window === "undefined") return;
  const state: MenuReturnState = { band, scrollY: Math.max(0, Math.round(scrollY)) };
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(state)); } catch { /* Storage is optional. */ }
}

export function readMenuReturn(): MenuReturnState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "null");
    if (!value || typeof value !== "object") return undefined;
    const state = value as Record<string, unknown>;
    if (!Number.isInteger(state.band) || Number(state.band) < 1 || Number(state.band) > 6) return undefined;
    if (typeof state.scrollY !== "number" || !Number.isFinite(state.scrollY) || state.scrollY < 0) return undefined;
    return { band: Number(state.band), scrollY: state.scrollY };
  } catch {
    return undefined;
  }
}

/** Reads the return-from-game position and removes it, so it is restored at most once. */
export function consumeMenuReturn(): MenuReturnState | undefined {
  const state = readMenuReturn();
  try { sessionStorage.removeItem(RETURN_KEY); } catch { /* Storage is optional. */ }
  return state;
}
