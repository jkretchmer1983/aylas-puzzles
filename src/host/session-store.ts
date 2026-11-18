import { parseStoredSession, type HubSession } from "./session-queue";

/** One hub session per tab (top-level sessionStorage; game iframes never read it). */
const KEY = "ayla-hub-session-v1";

export function readHubSession(): HubSession | null {
  if (typeof window === "undefined") return null;
  try { return parseStoredSession(JSON.parse(sessionStorage.getItem(KEY) ?? "null")); } catch { return null; }
}

export function saveHubSession(session: HubSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch { /* Storage is optional; play continues. */ }
}
