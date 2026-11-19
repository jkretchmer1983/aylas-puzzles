import type { PublicGameId } from "./public-games";

/** Published opaque child loaders own normal startup presentation, not readiness or timeout. */
const CHILD_LOADER_GAMES: ReadonlySet<PublicGameId> = new Set(["airship", "radio", "curiosity", "ticket", "take", "seating", "sofa", "ordering", "robot", "seaside", "trains", "money-change"]);

/**
 * Published child loaders whose real startup can legitimately outlast the shared ready timeout.
 * The slow state and its recovery actions are unchanged; only their presentation becomes a compact,
 * non-blocking panel so the child's loader and its own fallback controls stay visible and tappable.
 */
const COMPACT_SLOW_GAMES: ReadonlySet<PublicGameId> = new Set(["money-change"]);

export function hasPublishedChildLoader(gameId: PublicGameId | undefined): boolean {
  return gameId !== undefined && CHILD_LOADER_GAMES.has(gameId);
}

export function hasCompactSlowRecovery(gameId: PublicGameId | undefined): boolean {
  return hasPublishedChildLoader(gameId) && gameId !== undefined && COMPACT_SLOW_GAMES.has(gameId);
}
