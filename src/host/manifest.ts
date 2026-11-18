import { z } from "zod";
import { bandById, parsePublicCatalog, isPrivateHostname, recordSupportsBand, type PublicCatalog, type PublicCatalogRecord } from "@/lib/public-catalog";
import { gameSupportsBand, publicGameByCatalogId, type PublicGame } from "./public-games";

/**
 * Public release manifest served by the release service at /api/manifest:
 *   { catalog: PublicCatalog(v2), registry: { version: 1, revision, games: { [catalogId]: RegistryEntry } } }
 *
 * Release rules (owner-specified):
 *  - catalog.release === "available" is authoritative for published games. The release service only sets
 *    it on FIRST activation of a workflow-Done game; later workflow states (Updating / In Development) never
 *    withdraw an active release. hidden, age bounds and an explicit production active=false still propagate
 *    (the service then reports release !== "available" or drops the registry entry).
 *  - nextAction === "Done" is only QA / first-registration eligibility.
 *  - Hub: a game is playable only with release "available" AND a valid registered host URL.
 *  - Game host (own gate): its record is accepted when release "available", OR when it is not yet
 *    registered and nextAction is "Done" (standalone QA before the owner registers it).
 */
const registryEntrySchema = z.object({
  catalogId: z.string().min(1).max(100),
  gameId: z.string().min(1).max(40),
  url: z.string().min(1).max(300),
  releaseId: z.string().min(1).max(120),
}).strip();

const registrySchema = z.object({
  version: z.literal(1),
  revision: z.string().min(1).max(80),
  games: z.record(z.string(), registryEntrySchema),
}).strip();

export type RegistryEntry = z.infer<typeof registryEntrySchema>;
export type ReleaseRegistry = z.infer<typeof registrySchema>;
export type ReleaseManifest = { catalog: PublicCatalog; registry: ReleaseRegistry };

/** A registered host is a plain public HTTPS origin: no credentials, port, path, query or fragment. */
export function hostOriginFromUrl(value: string): string | undefined {
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return undefined;
  if (url.pathname !== "/" && url.pathname !== "") return undefined;
  if (isPrivateHostname(url.hostname)) return undefined;
  return url.origin;
}

/**
 * Strict parse. The whole manifest is rejected when the catalog is invalid; a registry entry that does not
 * describe one of the ten public games (wrong key, gameId or unsafe URL) is dropped, never trusted.
 */
export function parseReleaseManifest(input: unknown): ReleaseManifest {
  const value = (input ?? {}) as Record<string, unknown>;
  const catalog = parsePublicCatalog(value.catalog);
  const parsed = registrySchema.parse(value.registry);
  const games: Record<string, RegistryEntry> = {};
  for (const [key, entry] of Object.entries(parsed.games)) {
    const game = publicGameByCatalogId(key);
    if (!game || entry.catalogId !== key || entry.gameId !== game.gameId) continue;
    const origin = hostOriginFromUrl(entry.url);
    if (!origin) continue;
    games[key] = { ...entry, url: origin };
  }
  return { catalog, registry: { ...parsed, games } };
}

export const EMPTY_REGISTRY: ReleaseRegistry = { version: 1, revision: "none", games: {} };

function visibleForBand(record: PublicCatalogRecord, game: PublicGame, band: number) {
  return !record.hidden && gameSupportsBand(game, band) && recordSupportsBand(record, bandById(band));
}

export type HubGame = { game: PublicGame; record: PublicCatalogRecord; origin: string; releaseId: string };

/** Hub eligibility: available release + registered host + visible record covering the band. */
export function hubPlayableGames(manifest: ReleaseManifest, band: number): HubGame[] {
  return manifest.catalog.records.flatMap((record) => {
    const game = publicGameByCatalogId(record.id);
    const entry = manifest.registry.games[record.id];
    if (!game || !entry || record.release !== "available" || !visibleForBand(record, game, band)) return [];
    return [{ game, record, origin: entry.url, releaseId: entry.releaseId }];
  });
}

/** Game host's own gate for its single configured game. */
/**
 * A game host's own gate.
 *  - Public (published) origin: release "available" AND its own active registry entry whose URL is this
 *    origin. Missing, unregistered, withdrawn or hidden releases fail closed (back to the hub).
 *  - Private preview/dev QA origin only: also accepts an UNREGISTERED record whose workflow is "Done".
 * Either way the record must be visible and cover the band.
 */
export type ChildGateContext = { selfOrigin: string; privateQa: boolean };
export function childAcceptsRecord(manifest: ReleaseManifest, catalogId: string, band: number, context: ChildGateContext): boolean {
  const game = publicGameByCatalogId(catalogId);
  const record = manifest.catalog.records.find((item) => item.id === catalogId);
  if (!game || !record || !visibleForBand(record, game, band)) return false;
  const entry = manifest.registry.games[catalogId];
  if (!context.privateQa) return record.release === "available" && !!entry && entry.url === context.selfOrigin;
  if (record.release === "available") return true;
  return !entry && record.nextAction === "Done";
}
