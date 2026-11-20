import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { newSeed } from "@/gen/rng";
import { adapterByLaunchId } from "@/lib/game-adapters";
import { getCurrentCatalog, getCurrentRegistry, refreshCatalog, useCatalog, useManifestStatus, useRegistry } from "@/lib/catalog-store";
import { CANONICAL_HUB_ORIGIN, HOST_ROLE } from "@/host/config";
import { eligibleLaunchIds } from "@/host/eligibility";
import { requestHostBack, requestHostNext, requestHostPrevious, useHostEmbedded } from "@/host/child-bridge";
import { dealPlayAllGame, resumePlayAllGame } from "@/lib/play-all";

/** Search fields every menu-launched game carries so Next and the menu keep the selected band. */
export type CommonsSearch = { from?: "commons" | undefined; all?: 1 | undefined };

export function parseCommonsSearch(search: Record<string, unknown>): CommonsSearch {
  return {
    from: search.from === "commons" ? "commons" : undefined,
    all: search.all === 1 || search.all === "1" ? 1 : undefined,
  };
}

export function clampBand(value: unknown, min: number, max: number) {
  const band = Math.floor(Number(value));
  return Number.isInteger(band) ? Math.max(min, Math.min(max, band)) : min;
}

/** App-wide menu bands (Ages 4–5 … 9–10). */
export const MENU_BAND_MIN = 1;
export const MENU_BAND_MAX = 6;

/**
 * Game routes accept any valid menu band unchanged. A game's own age range is never applied here:
 * useCommonsGate rejects an ineligible band and returns to the menu with that same band.
 */
export function parseRouteBand(value: unknown) {
  const band = Number(value);
  return Number.isInteger(band) && band >= MENU_BAND_MIN && band <= MENU_BAND_MAX ? band : MENU_BAND_MIN;
}

type Navigate = ReturnType<typeof useNavigate>;

/** Launches a fresh instance of an installed same-origin game. Unknown IDs go back to the menu. */
export function launchCommonsGame(nav: Navigate, launchId: string, band: number, options: { all?: boolean; replace?: boolean } = {}) {
  const all = options.all ? (1 as const) : undefined;
  const replace = options.replace ?? false;
  const from = "commons" as const;
  const adapter = adapterByLaunchId(launchId);
  if (!adapter) return nav({ to: "/", search: { band }, replace });
  switch (adapter.route) {
    case "/robot": return nav({ to: "/robot", search: { band, s: newSeed(), from, all }, replace });
    case "/sofa": return nav({ to: "/sofa", search: { band, seed: newSeed(), from, all }, replace });
    case "/seating": return nav({ to: "/seating", search: { band, seed: newSeed(), from, all }, replace });
    case "/airship": return nav({ to: "/airship", search: { band, s: newSeed(), from, all }, replace });
    // Seaside deals its own fresh seed and cast on arrival (it keeps longer lines coming from the recent trail).
    case "/seaside-scoop": return nav({ to: "/seaside-scoop", search: { band, from, all }, replace });
    case "/ordering": return nav({ to: "/ordering", search: { band, s: newSeed(), from, all }, replace });
    case "/radio": return nav({ to: "/radio", search: { band, s: newSeed(), from, all }, replace });
    // Curiosity deals its own fresh seed on arrival (avoiding recently seen themes).
    case "/curiosity": return nav({ to: "/curiosity", search: { band, from, all }, replace });
    case "/ticket-machine": return nav({ to: "/ticket-machine", search: { band, s: newSeed(), from, all }, replace });
    default: return nav({ to: "/play", search: { band, t: adapter.templateId, s: newSeed(), from, all }, replace });
  }
}

/**
 * A STANDALONE game host's top Next/Previous arrow: hand the type change to the canonical hub, which
 * consumes the step once and picks a different eligible game relative to this one.
 */
export function hubStepHref(band: number, gameId: string, step: "next" | "previous", hubOrigin: string = CANONICAL_HUB_ORIGIN) {
  const params = new URLSearchParams({ band: String(parseRouteBand(band)), mode: "all", game: gameId, step });
  return `${hubOrigin}/session?${params.toString()}`;
}

/** Same-origin review build: Previous opens the previous eligible type in catalog order (fresh). */
function previousTypeGame(nav: Navigate, band: number, currentId: string) {
  const allowed = eligibleLaunchIds(getCurrentCatalog(), getCurrentRegistry(), band);
  const others = allowed.filter((id) => id !== currentId);
  if (!others.length) return;
  const index = allowed.indexOf(currentId);
  const target = index < 0 ? others[others.length - 1]! : allowed[(index - 1 + allowed.length) % allowed.length]!;
  launchCommonsGame(nav, target, band, { all: true });
}

/** Play All: deal the next game from the persisted no-repeat deck under the catalog as it is right now. */
export function nextPlayAllGame(nav: Navigate, band: number, currentId: string) {
  const allowed = eligibleLaunchIds(getCurrentCatalog(), getCurrentRegistry(), band);
  const next = dealPlayAllGame(band, allowed, currentId);
  if (next) launchCommonsGame(nav, next.id, band, { all: true });
  else nav({ to: "/", search: { band } });
}

/**
 * Standalone game routes: withdrawn, out-of-age or uninstalled games return to the menu with the band
 * intact; an explicit Play All URL keeps its current game in the dealt set.
 */
export function useCommonsGate(launchId: string, band: number, search: CommonsSearch) {
  const nav = useNavigate();
  const catalog = useCatalog();
  const registry = useRegistry();
  const status = useManifestStatus();
  const allowed = eligibleLaunchIds(catalog, registry, band);
  const playable = allowed.includes(launchId);
  // Inside a hub session the hub owns age, mode, queue and Back; it validated this game before launch.
  const embedded = useHostEmbedded();
  useEffect(() => { void refreshCatalog(); }, [band, launchId]);
  // A game host decides only after this page load's manifest fetch settles (never on the bundled snapshot).
  const deciding = HOST_ROLE === "game" && status === "pending";
  useEffect(() => {
    if (playable || deciding) return;
    if (embedded) requestHostBack();
    // A game host has no menu: fail closed to the canonical hub with the same age.
    else if (HOST_ROLE === "game") window.location.replace(`${CANONICAL_HUB_ORIGIN}/?band=${band}`);
    else void nav({ to: "/", search: { band }, replace: true });
  }, [playable, deciding, band, nav, embedded]);
  useEffect(() => {
    if (!embedded && playable && search.all === 1) resumePlayAllGame(band, allowed, launchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable, search.all, band, launchId, embedded]);
  const playAll = embedded || (search.from === "commons" && search.all === 1);
  return {
    playable,
    /** True when Next must be delegated: an embedded hub session (single or Play all) or same-origin Play all. */
    playAll,
    embedded,
    /** Top Next: a different puzzle type (hub session, standalone host → hub step, or review deck). */
    nextAdventure: () => {
      if (embedded) requestHostNext();
      else if (HOST_ROLE === "game") window.location.assign(hubStepHref(band, launchId, "next"));
      else nextPlayAllGame(nav, band, launchId);
    },
    /** Top Previous: the previous different puzzle type. */
    previousAdventure: () => {
      if (embedded) requestHostPrevious();
      else if (HOST_ROLE === "game") window.location.assign(hubStepHref(band, launchId, "previous"));
      else previousTypeGame(nav, band, launchId);
    },
  };
}
