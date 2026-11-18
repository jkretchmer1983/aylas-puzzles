import raw from "./host.config.json";
import { publicGameByCatalogId, type PublicGame } from "./public-games";

/**
 * Build role, committed per package by scripts/export-host-packages.ts:
 *  - "master": this private review project (menu + every installed game, same-origin session preview);
 *  - "hub": the thin public menu at the canonical domain, launching registered game hosts in iframes;
 *  - "game": one independently deployed game host that serves ONLY its configured game.
 */
export type HostRole = "master" | "hub" | "game";
export type HostConfig = {
  role: HostRole;
  catalogId?: string | undefined;
  sourceVersion?: string | undefined;
  /** Public release manifest (catalog + registry). Only a plain HTTPS URL is accepted. */
  manifestUrl?: string | undefined;
};

export const CANONICAL_HUB_ORIGIN = "https://aylas-puzzles.lovable.app";
export const DEFAULT_MANIFEST_URL = "https://aylas-game-releases.coatedscarf3.chatgpt.site/api/manifest";

function checkedConfig(value: unknown): HostConfig {
  const config = (value ?? {}) as Record<string, unknown>;
  const role = config.role;
  if (role !== "master" && role !== "hub" && role !== "game") throw new Error("host.config.json: unknown role");
  const manifestUrl = typeof config.manifestUrl === "string" ? config.manifestUrl : undefined;
  if (manifestUrl) {
    const url = new URL(manifestUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("host.config.json: manifestUrl must be plain HTTPS");
  }
  const catalogId = typeof config.catalogId === "string" ? config.catalogId : undefined;
  if (role === "game" && (!catalogId || !publicGameByCatalogId(catalogId))) throw new Error("host.config.json: a game host needs one public catalogId");
  return { role, catalogId, sourceVersion: typeof config.sourceVersion === "string" ? config.sourceVersion : undefined, manifestUrl };
}

export const HOST_CONFIG: HostConfig = checkedConfig(raw);
export const HOST_ROLE: HostRole = HOST_CONFIG.role;
export const MANIFEST_URL = HOST_CONFIG.manifestUrl ?? DEFAULT_MANIFEST_URL;

/** The single game a "game" host serves (undefined for master/hub). */
export const HOST_GAME: PublicGame | undefined = HOST_ROLE === "game" && HOST_CONFIG.catalogId ? publicGameByCatalogId(HOST_CONFIG.catalogId) : undefined;

/** Paths a game host serves; anything else redirects to its game. API routes are server-only and not affected. */
export function hostAllowsPath(pathname: string): boolean {
  if (HOST_ROLE === "master") return true;
  if (HOST_ROLE === "hub") return pathname === "/" || pathname === "/session";
  return !!HOST_GAME && pathname === HOST_GAME.path;
}

/** Where a host sends paths it does not serve: the hub to its menu, a game host to a fresh instance of its game. */
export function hostEntryHref(search: Record<string, unknown>, seed: number = 1 + Math.floor(Math.random() * 2_000_000_000)): string {
  if (HOST_ROLE !== "game" || !HOST_GAME) return "/";
  const band = Number(search.band);
  const chosen = Number.isInteger(band) && band >= 1 && band <= 6 ? band : 1;
  const params = new URLSearchParams({ ...HOST_GAME.fixed, band: String(chosen) });
  if (HOST_GAME.seedParam) params.set(HOST_GAME.seedParam, String(seed));
  return `${HOST_GAME.path}?${params.toString()}`;
}
