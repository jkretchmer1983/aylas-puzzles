import { isReleasedTemplateId } from "@/lib/released-ids";

/** Where an installed same-origin implementation lives. Never a preview/editor URL. */
export type GameRoute = "/play" | "/robot" | "/sofa" | "/seating" | "/airship" | "/seaside-scoop" | "/ordering" | "/radio" | "/curiosity" | "/ticket-machine";

/** Only same-origin, installed scene implementations may be launched. */
export type InstalledGameAdapter = {
  catalogId: "v1-sudoku" | "v1-pattern" | "v1-take" | "v2-robot" | "v2-sofa" | "v2-seating" | "v1-shapepick" | "v1-position" | "v1-lineup" | "v1-cipher" | "v2-curiosity" | "v1-riddle";
  /** Launch ID used by Play All decks; for /play games it is also the generator template ID. */
  templateId: "sudoku" | "pattern" | "take" | "robot" | "sofa" | "seating" | "airship" | "seaside" | "ordering" | "radio" | "curiosity" | "ticket";
  route: GameRoute;
  minBand: number;
  maxBand: number;
};

/**
 * Band limits document prior testing only. Live dashboard ages alone decide age eligibility.
 */
export const INSTALLED_SCENE_ADAPTERS: readonly InstalledGameAdapter[] = [
  { catalogId: "v1-sudoku", templateId: "sudoku", route: "/play", minBand: 2, maxBand: 6 },
  { catalogId: "v1-pattern", templateId: "pattern", route: "/play", minBand: 1, maxBand: 6 },
  { catalogId: "v1-take", templateId: "take", route: "/play", minBand: 1, maxBand: 3 },
  { catalogId: "v2-robot", templateId: "robot", route: "/robot", minBand: 4, maxBand: 6 },
  { catalogId: "v2-sofa", templateId: "sofa", route: "/sofa", minBand: 1, maxBand: 6 },
  { catalogId: "v2-seating", templateId: "seating", route: "/seating", minBand: 3, maxBand: 6 },
  { catalogId: "v1-shapepick", templateId: "airship", route: "/airship", minBand: 1, maxBand: 2 },
  // Seaside's generator supports ages 4–6 only: menu bands 1 (4–5) and 2 (5–6).
  { catalogId: "v1-position", templateId: "seaside", route: "/seaside-scoop", minBand: 1, maxBand: 2 },
  // Everybody Says They Won (race ordering): menu bands 2–6 (ages 5–10).
  { catalogId: "v1-lineup", templateId: "ordering", route: "/ordering", minBand: 2, maxBand: 6 },
  // The Radio Has Opinions · Symbol Codes: menu bands 3–6 (ages 6–10), the cipher generator's tested range.
  { catalogId: "v1-cipher", templateId: "radio", route: "/radio", minBand: 3, maxBand: 6 },
  // The Curiosity Trail: its own engine (never the Pattern Loom template); menu bands 1–5 (ages 4–9).
  { catalogId: "v2-curiosity", templateId: "curiosity", route: "/curiosity", minBand: 1, maxBand: 5 },
  // The Ticket Machine Is Being Difficult: dashboard ages 7–10 = menu bands 4–6 (the engine also has a band 3 the catalog does not release).
  { catalogId: "v1-riddle", templateId: "ticket", route: "/ticket-machine", minBand: 4, maxBand: 6 },
] as const;

export function adapterByLaunchId(id: string) {
  return INSTALLED_SCENE_ADAPTERS.find((item) => item.templateId === id);
}

export function installedAdapterForBand(catalogId: string, band: number) {
  const adapter = INSTALLED_SCENE_ADAPTERS.find((item) => item.catalogId === catalogId);
  if (!adapter || !Number.isInteger(band) || band < 1 || band > 6) return undefined;
  // Generator-backed /play games also pass the template release allowlist (Pattern Loom is not released);
  // their tested band ranges are the adapter min/max above.
  if (adapter.route === "/play") return isReleasedTemplateId(adapter.templateId) ? adapter : undefined;
  return adapter;
}
