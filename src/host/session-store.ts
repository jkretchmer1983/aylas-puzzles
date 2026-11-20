import { parseStoredSession, type HubSession } from "./session-queue";

/** One hub session per tab (top-level sessionStorage; game iframes never read it). */
const KEY = "ayla-hub-session-v1";
/** The private review harness keeps its own session so it never mixes with real play. */
const REVIEW_KEY = "ayla-hub-review-session-v1";
const keyFor = (review?: boolean) => review ? REVIEW_KEY : KEY;

export function readHubSession(review?: boolean): HubSession | null {
  if (typeof window === "undefined") return null;
  try { return parseStoredSession(JSON.parse(sessionStorage.getItem(keyFor(review)) ?? "null")); } catch { return null; }
}

export function saveHubSession(session: HubSession | null, review?: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (session) sessionStorage.setItem(keyFor(review), JSON.stringify(session));
    else sessionStorage.removeItem(keyFor(review));
  } catch { /* Storage is optional; play continues. */ }
}

/**
 * A standalone game host's top arrow (/session?…&game=X&step=next|previous) is recorded here, the address
 * bar is cleaned at once, and the session start consumes it exactly once — a refresh never repeats it.
 */
const STEP_KEY = "ayla-hub-step-intent-v1";
export type StepIntent = { band: number; gameId: string; step: "next" | "previous" };

export function saveStepIntent(intent: StepIntent) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(STEP_KEY, JSON.stringify(intent)); } catch { /* Storage is optional. */ }
}

export function consumeStepIntent(band: number): StepIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STEP_KEY) ?? "null");
    sessionStorage.removeItem(STEP_KEY);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (v.band !== band || typeof v.gameId !== "string" || (v.step !== "next" && v.step !== "previous")) return null;
    return { band, gameId: v.gameId, step: v.step };
  } catch { return null; }
}
