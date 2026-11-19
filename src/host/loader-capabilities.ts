import type { PublicGameId } from "./public-games";

/** Published opaque child loaders own normal startup presentation, not readiness or timeout. */
const CHILD_LOADER_GAMES: ReadonlySet<PublicGameId> = new Set(["airship", "radio", "curiosity", "ticket", "take", "seating", "sofa", "ordering", "robot", "seaside"]);

export function hasPublishedChildLoader(gameId: PublicGameId | undefined): boolean {
  return gameId !== undefined && CHILD_LOADER_GAMES.has(gameId);
}