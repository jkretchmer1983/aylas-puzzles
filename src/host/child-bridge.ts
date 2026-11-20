import { useSyncExternalStore } from "react";
import { allowedParentOrigins } from "./origins";
import { HOST_GAME, HOST_ROLE } from "./config";
import { HOST_LAUNCH_PARAMS, makeMessage, parseParentMessage, readLaunchIdentity, type ChildMessageType, type HostIdentity, type TypeDirection } from "./protocol";

/**
 * Child (game iframe) side of the hub protocol. Inert unless this window was launched by a hub with a
 * valid identity in its first URL AND is actually framed. Standalone play is untouched.
 *
 * Suppression: while the hub prepares this instance hidden (phase "prepare") or pauses it, every game
 * audio wrapper checks isHostSuppressed() and plays nothing; CSS animations pause through
 * html[data-host-suppressed]. Nothing is written to sound-setting storage, so activation simply resumes
 * the user's own saved preferences.
 */
type State = {
  identity: HostIdentity | null;
  parentOrigin: string | null;
  phase: "standalone" | "prepare" | "active" | "paused";
  readySent: boolean;
};

const state: State = { identity: null, parentOrigin: null, phase: "standalone", readySent: false };
const listeners = new Set<() => void>();
const pauseHandlers = new Set<() => void>();
let installed = false;
let readyHolds = 0;
let readyTimer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((listener) => listener());

export function isHostEmbedded() { return state.identity !== null; }
export function isHostSuppressed() { return state.identity !== null && state.phase !== "active"; }
export function hostPhase() { return state.phase; }
export function subscribeHost(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Game audio modules register their stop function; called when the hub hides or pauses this instance. */
export function onHostPause(stop: () => void) { pauseHandlers.add(stop); return () => { pauseHandlers.delete(stop); }; }

function setPhase(phase: State["phase"]) {
  if (state.phase === phase) return;
  state.phase = phase;
  if (typeof document !== "undefined") {
    if (phase === "prepare" || phase === "paused") document.documentElement.dataset.hostSuppressed = "true";
    else delete document.documentElement.dataset.hostSuppressed;
  }
  if (phase !== "active") pauseHandlers.forEach((stop) => { try { stop(); } catch { /* A stop failure never blocks the bridge. */ } });
  emit();
}

function post(type: ChildMessageType, extra: { href?: string; direction?: TypeDirection } = {}) {
  if (!state.identity || !state.parentOrigin) return false;
  window.parent.postMessage(makeMessage(type, state.identity, extra), state.parentOrigin);
  return true;
}

/** Plain Next keeps each game's original behaviour; a type-navigation game may pass +1 / -1 to step puzzle type. */
export function requestHostNext(direction?: TypeDirection) { return post("next", direction === 1 || direction === -1 ? { direction } : {}); }
export function requestHostBack() { return post("back"); }

/** Report the current same-game location so a hub refresh can restore this exact instance. */
let lastHref: string | null = null;
/** The embedded game's last in-game location (used to stay put when an in-game link targets the menu). */
export function lastHostHref() { return lastHref; }

export function reportHostLocation(pathname: string, search: string) {
  if (!state.identity) return;
  const params = new URLSearchParams(search);
  HOST_LAUNCH_PARAMS.forEach((key) => params.delete(key));
  const query = params.toString();
  if (pathname === "/") return;
  lastHref = `${pathname}${query ? `?${query}` : ""}`;
  post("location", { href: lastHref });
}

/**
 * Readiness = real content ready, not just mounted: fonts loaded, current images decoded, and no game
 * hold (holdHostReady) or visible [data-host-busy] loader for a short settle window. Bounded so the
 * game's own original offline/fallback content still reports ready.
 */
const READY_SETTLE_MS = 400;
const READY_MAX_MS = 12_000;

export function holdHostReady(): () => void {
  readyHolds++;
  let released = false;
  return () => { if (released) return; released = true; readyHolds = Math.max(0, readyHolds - 1); scheduleReady(); };
}

function contentSettled() {
  if (readyHolds > 0) return false;
  if (document.querySelector("[data-host-busy]")) return false;
  return Array.from(document.images).every((img) => img.complete);
}

let readyStarted = 0;
function scheduleReady() {
  if (!state.identity || !state.parentOrigin || state.readySent) return;
  clearTimeout(readyTimer);
  readyTimer = setTimeout(async () => {
    if (state.readySent) return;
    try { await document.fonts?.ready; } catch { /* Fonts are optional. */ }
    const timedOut = Date.now() - readyStarted > READY_MAX_MS;
    if (!timedOut && !contentSettled()) { scheduleReady(); return; }
    state.readySent = true;
    post("ready");
  }, READY_SETTLE_MS);
}

function onMessage(event: MessageEvent) {
  if (!state.identity || event.source !== window.parent) return;
  if (!allowedParentOrigins(window.location.origin).includes(event.origin)) return;
  if (state.parentOrigin && event.origin !== state.parentOrigin) return;
  const message = parseParentMessage(event.data, state.identity);
  if (!message) return;
  if (message.type === "init") {
    if (!state.parentOrigin) {
      state.parentOrigin = event.origin;
      readyStarted = Date.now();
    }
    post("hello");
    reportHostLocation(window.location.pathname, window.location.search);
    scheduleReady();
    if (state.readySent) post("ready");
    return;
  }
  if (message.type === "activate") setPhase("active");
  else if (message.type === "pause") setPhase("paused");
  else if (message.type === "prepare") setPhase("prepare");
}

/** Embedded Back: any link to the menu ("/") asks the hub to return to its menu instead. */
function onClick(event: MouseEvent) {
  if (!state.identity || event.defaultPrevented || event.button !== 0) return;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== "/") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  requestHostBack();
}

/** Called once on the client from the root route. */
export function installChildBridge() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  if (HOST_ROLE === "hub") return;
  if (window.parent === window) return;
  const identity = readLaunchIdentity(window.location.search);
  if (!identity) return;
  // A game host only ever answers for its own configured game.
  if (HOST_ROLE === "game" && identity.gameId !== HOST_GAME?.gameId) return;
  state.identity = { session: identity.session, nonce: identity.nonce, gameId: identity.gameId };
  setPhase(identity.phase);
  window.addEventListener("message", onMessage);
  document.addEventListener("click", onClick, true);
}

/** Test helper. */
export function resetChildBridgeForTests() {
  if (typeof window !== "undefined") {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("click", onClick, true);
    delete document.documentElement.dataset.hostSuppressed;
  }
  state.identity = null; state.parentOrigin = null; state.phase = "standalone"; state.readySent = false;
  installed = false; readyHolds = 0; lastHref = null; clearTimeout(readyTimer);
  listeners.clear(); pauseHandlers.clear();
}

/** Hydration-safe React view: false on the server and first client render, then the real state. */
export function useHostEmbedded(): boolean {
  return useSyncExternalStore(subscribeHost, isHostEmbedded, () => false);
}
