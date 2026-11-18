/**
 * Generator-backed /play templates in the public release. Pattern Loom is not workflow Done, so it is
 * excluded from public play, sessions, Play All and MCP until it is explicitly released.
 */
export const RELEASED_GAME_IDS = ["sudoku", "take"] as const;
export type ReleasedGameId = (typeof RELEASED_GAME_IDS)[number];
export const isReleasedTemplateId = (id: string): id is ReleasedGameId => (RELEASED_GAME_IDS as readonly string[]).includes(id);
