import { HOST_GAME, HOST_ROLE } from "./config";
import { childAcceptsRecord, hubPlayableGames, type ChildGateContext, type ReleaseRegistry } from "./manifest";
import { isPrivateQaOrigin } from "./origins";
import { gameSupportsBand, publicGameByCatalogId, publicGameById, PUBLIC_GAME_IDS } from "./public-games";
import { playableTemplateIds, type CatalogGame, type PublicCatalog, type PublicCatalogRecord } from "@/lib/public-catalog";
import { INSTALLED_SCENE_ADAPTERS, installedAdapterForBand } from "@/lib/game-adapters";

/** One launchable game for the hub session: its release ID and exact registered origin. */
export type SessionTarget = { gameId: string; releaseId: string; origin: string };

/** This page's own gate context; undefined on the server, so SSR never opens a game host. */
function ownGateContext(): ChildGateContext | undefined {
  if (typeof window === "undefined") return undefined;
  const selfOrigin = window.location.origin;
  return { selfOrigin, privateQa: isPrivateQaOrigin(selfOrigin) };
}

const adapterFor = (catalogId: string) => INSTALLED_SCENE_ADAPTERS.find((item) => item.catalogId === catalogId);

/**
 * Which adapter (if any) makes a catalog card playable in the current build role:
 *  - master: catalog "available" + installed same-origin adapter (Pattern Loom is not released);
 *  - hub:    catalog "available" + registered host URL (the game lives in its own project);
 *  - game:   only its own game, by the host's own gate (public origin: available + own registry entry;
 *            private preview/dev QA origin: also unregistered + Done).
 */
export function roleAdapterResolver(catalog: PublicCatalog, registry: ReleaseRegistry) {
  return (record: PublicCatalogRecord, band: number): CatalogGame["adapter"] => {
    if (HOST_ROLE === "master") return record.release === "available" ? installedAdapterForBand(record.id, band) : undefined;
    const game = publicGameByCatalogId(record.id);
    if (!game) return undefined;
    const manifest = { catalog, registry };
    if (HOST_ROLE === "hub") return hubPlayableGames(manifest, band).some((item) => item.game.catalogId === record.id) ? { templateId: game.gameId } : undefined;
    const context = ownGateContext();
    return context && HOST_GAME?.catalogId === record.id && childAcceptsRecord(manifest, record.id, band, context) ? adapterFor(record.id) : undefined;
  };
}

/** Launch IDs routes, Next and Play All may use right now in this role. */
export function eligibleLaunchIds(catalog: PublicCatalog, registry: ReleaseRegistry, band: number): string[] {
  if (HOST_ROLE === "master") return playableTemplateIds(catalog, band);
  if (HOST_ROLE === "hub") return hubPlayableGames({ catalog, registry }, band).map((item) => item.game.gameId);
  const game = HOST_GAME;
  const context = ownGateContext();
  return game && context && gameSupportsBand(game, band) && childAcceptsRecord({ catalog, registry }, game.catalogId, band, context) ? [game.gameId] : [];
}

/** Hub session targets: public Done games only. The master review build embeds its own routes. */
export function sessionTargets(catalog: PublicCatalog, registry: ReleaseRegistry, band: number, selfOrigin: string): SessionTarget[] {
  if (HOST_ROLE === "hub") return hubPlayableGames({ catalog, registry }, band).map((item) => ({ gameId: item.game.gameId, releaseId: item.releaseId, origin: item.origin }));
  if (HOST_ROLE === "master") {
    return playableTemplateIds(catalog, band)
      .filter((id) => { const game = publicGameById(id); return PUBLIC_GAME_IDS.some((gameId) => gameId === id) && game && gameSupportsBand(game, band); })
      .map((gameId) => ({ gameId, releaseId: "local", origin: selfOrigin }));
  }
  return [];
}
