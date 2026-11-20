/**
 * The approved public games and their fixed host entry points. This is the ONLY list a hub or
 * game host may launch; it carries no URLs (those come from the runtime release registry).
 * Band ranges are informational tested ranges only; live dashboard ages govern eligibility.
 */
export type PublicGameId = "sudoku" | "take" | "ordering" | "radio" | "seaside" | "airship" | "robot" | "curiosity" | "sofa" | "seating" | "ticket" | "money-change" | "trains" | "water";
export type PublicCatalogId = "v1-sudoku" | "v1-take" | "v1-lineup" | "v1-cipher" | "v1-position" | "v1-shapepick" | "v2-robot" | "v2-curiosity" | "v2-sofa" | "v2-seating" | "v1-riddle" | "v1-change" | "v2-trains" | "v2-waterway";

export type PublicGame = {
  catalogId: PublicCatalogId;
  /** Launch ID (also the /play template for Sudoku and Up & Away). */
  gameId: PublicGameId;
  title: string;
  /** Fixed same-origin route the game's host serves. */
  path: "/play" | "/robot" | "/sofa" | "/seating" | "/airship" | "/seaside-scoop" | "/ordering" | "/radio" | "/curiosity" | "/ticket-machine" | "/money-change" | "/adventures";
  /** Fixed query fields (never taken from messages or the address bar). */
  fixed: Readonly<Record<string, string>>;
  /** Query field that carries a fresh seed; null = the engine deals its own fresh seed on arrival. */
  seedParam: "s" | "seed" | null;
  minBand: number;
  maxBand: number;
};

export const PUBLIC_GAMES: readonly PublicGame[] = [
  { catalogId: "v1-sudoku", gameId: "sudoku", title: "Forest Sudoku", path: "/play", fixed: { t: "sudoku" }, seedParam: "s", minBand: 2, maxBand: 6 },
  { catalogId: "v1-take", gameId: "take", title: "Up and Away · Taking Away", path: "/play", fixed: { t: "take" }, seedParam: "s", minBand: 1, maxBand: 3 },
  { catalogId: "v1-lineup", gameId: "ordering", title: "Everybody Says They Won", path: "/ordering", fixed: {}, seedParam: "s", minBand: 2, maxBand: 6 },
  { catalogId: "v1-cipher", gameId: "radio", title: "The Radio Has Opinions · Symbol Codes", path: "/radio", fixed: {}, seedParam: "s", minBand: 3, maxBand: 6 },
  { catalogId: "v1-position", gameId: "seaside", title: "The Seaside Scoop Stop", path: "/seaside-scoop", fixed: {}, seedParam: null, minBand: 1, maxBand: 2 },
  { catalogId: "v1-shapepick", gameId: "airship", title: "The Airship Shape Hunt", path: "/airship", fixed: {}, seedParam: "s", minBand: 1, maxBand: 2 },
  { catalogId: "v2-robot", gameId: "robot", title: "The Robot Took a Shortcut", path: "/robot", fixed: {}, seedParam: "s", minBand: 4, maxBand: 6 },
  { catalogId: "v2-curiosity", gameId: "curiosity", title: "The Curiosity Trail", path: "/curiosity", fixed: {}, seedParam: null, minBand: 1, maxBand: 5 },
  { catalogId: "v2-sofa", gameId: "sofa", title: "The Sofa Has Had Enough", path: "/sofa", fixed: {}, seedParam: "seed", minBand: 1, maxBand: 6 },
  { catalogId: "v2-seating", gameId: "seating", title: "Who Goes Where?", path: "/seating", fixed: {}, seedParam: "seed", minBand: 3, maxBand: 6 },
  { catalogId: "v1-riddle", gameId: "ticket", title: "The Ticket Machine Is Being Difficult", path: "/ticket-machine", fixed: {}, seedParam: "s", minBand: 4, maxBand: 6 },
  { catalogId: "v1-change", gameId: "money-change", title: "The Till Is On Its Lunch Break", path: "/money-change", fixed: {}, seedParam: "s", minBand: 3, maxBand: 6 },
  { catalogId: "v2-trains", gameId: "trains", title: "The Great Train Tangle", path: "/adventures", fixed: { game: "trains" }, seedParam: "seed", minBand: 1, maxBand: 6 },
  // Same /adventures engine family as Train; the host maps band to age. Live dashboard ages govern eligibility.
  { catalogId: "v2-waterway", gameId: "water", title: "The Cloud Hired a Plumber", path: "/adventures", fixed: { game: "water" }, seedParam: "seed", minBand: 1, maxBand: 6 },
];

export const PUBLIC_GAME_IDS = PUBLIC_GAMES.map((game) => game.gameId);

export function publicGameById(id: string): PublicGame | undefined {
  return PUBLIC_GAMES.find((game) => game.gameId === id);
}

export function publicGameByCatalogId(id: string): PublicGame | undefined {
  return PUBLIC_GAMES.find((game) => game.catalogId === id);
}

export function gameSupportsBand(game: PublicGame, band: number) {
  return Number.isInteger(band) && band >= 1 && band <= 6;
}
