import { useSyncExternalStore } from "react";
import { CATALOG_SNAPSHOT, parsePublicCatalog, type PublicCatalog } from "@/lib/public-catalog";
import { HOST_ROLE, MANIFEST_URL } from "@/host/config";
import { EMPTY_REGISTRY, parseReleaseManifest, type ReleaseRegistry } from "@/host/manifest";

/**
 * The one current public catalog shared by the menu, /play, Next and Play All.
 * Order of trust: latest validated server response > last valid device cache > bundled snapshot.
 * A valid empty catalog is kept as-is; it never falls back to the bundled playable list.
 */
export const CATALOG_CACHE_KEY = "ayla-commons-catalog-v2";
const REFRESH_INTERVAL_MS = 30_000;

let current: PublicCatalog | undefined;
/** Hub/game roles: the release registry from the same atomic manifest as the catalog. */
let registry: ReleaseRegistry = EMPTY_REGISTRY;
export const REGISTRY_CACHE_KEY = "ayla-release-registry-v1";
let inflight: Promise<PublicCatalog> | undefined;
/**
 * Hub/game roles: whether this page load has a decision-grade manifest yet. "pending" until the first
 * fetch settles; "fresh" after a valid manifest; "failed" when the fetch failed (last valid cache, if any,
 * stays in force — a never-cached registry stays empty, so a game host fails closed).
 */
export type ManifestStatus = "pending" | "fresh" | "failed";
let manifestStatus: ManifestStatus = "pending";
const MANIFEST_TIMEOUT_MS = 8000;
let lastFetched = 0;
const listeners = new Set<() => void>();

function readCache(): PublicCatalog | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const cached: unknown = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) ?? "null");
    return cached ? parsePublicCatalog(cached) : undefined;
  } catch {
    return undefined;
  }
}

export function getCurrentRegistry(): ReleaseRegistry {
  if (typeof window !== "undefined" && registry === EMPTY_REGISTRY) {
    try {
      const cached: unknown = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) ?? "null");
      const catalog = getCurrentCatalog();
      if (cached) registry = parseReleaseManifest({ catalog, registry: cached }).registry;
    } catch { /* A bad cache is ignored. */ }
  }
  return registry;
}

/** Accepts only a fully valid manifest; catalog and registry are replaced together. */
export function setCurrentManifest(input: unknown) {
  const manifest = parseReleaseManifest(input);
  registry = manifest.registry;
  manifestStatus = "fresh";
  try { localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(manifest.registry)); } catch { /* Storage is optional. */ }
  setCurrentCatalog(manifest.catalog);
  return manifest;
}

export function getCurrentCatalog(): PublicCatalog {
  if (typeof window === "undefined") return CATALOG_SNAPSHOT;
  current ??= readCache() ?? CATALOG_SNAPSHOT;
  return current;
}

/** Accepts only a validated catalog; invalid input leaves the current catalog unchanged. */
export function setCurrentCatalog(input: unknown): PublicCatalog {
  const next = parsePublicCatalog(input);
  current = next;
  try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  listeners.forEach((listener) => listener());
  return next;
}

export function refreshCatalog(force = false): Promise<PublicCatalog> {
  if (typeof window === "undefined") return Promise.resolve(CATALOG_SNAPSHOT);
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetched < REFRESH_INTERVAL_MS) return Promise.resolve(getCurrentCatalog());
  lastFetched = Date.now();
  // Production hub and game hosts read the public release manifest (catalog + registry) directly.
  const fromManifest = HOST_ROLE !== "master";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  inflight = fetch(fromManifest ? MANIFEST_URL : "/api/public/catalog", { headers: { Accept: "application/json" }, cache: "no-store", credentials: "omit", signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      return response.json() as Promise<unknown>;
    })
    .then((value) => fromManifest ? setCurrentManifest(value).catalog : setCurrentCatalog(value))
    .catch(() => {
      if (manifestStatus === "pending") { manifestStatus = "failed"; listeners.forEach((listener) => listener()); }
      return getCurrentCatalog();
    })
    .finally(() => { clearTimeout(timer); inflight = undefined; });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** React view of the shared catalog; server render and hydration use the bundled snapshot. */
export function useCatalog(): PublicCatalog {
  return useSyncExternalStore(subscribe, getCurrentCatalog, () => CATALOG_SNAPSHOT);
}

/** React view of the release registry (hub/game roles); empty on the server and in the master build. */
export function useRegistry(): ReleaseRegistry {
  return useSyncExternalStore(subscribe, getCurrentRegistry, () => EMPTY_REGISTRY);
}

export function getManifestStatus(): ManifestStatus { return manifestStatus; }
/** React view of the manifest status ("pending" on the server, so SSR never decides a game host's gate). */
export function useManifestStatus(): ManifestStatus {
  return useSyncExternalStore(subscribe, getManifestStatus, () => "pending");
}

/** Test helper: forget in-memory state. */
export function resetCatalogStoreForTests() {
  current = undefined;
  registry = EMPTY_REGISTRY;
  inflight = undefined;
  lastFetched = 0;
  manifestStatus = "pending";
}
