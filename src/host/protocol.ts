import { publicGameById, type PublicGame } from "./public-games";

/**
 * Hub ⇄ game-host postMessage protocol, version 1.
 *
 * Parent (hub) → child (game iframe):  init · activate · pause · prepare
 * Child → parent:                      hello · ready · location · next · previous · back
 *   next / previous = the TOP arrows: change PUZZLE TYPE (a different eligible game). back = Home (menu).
 *   A new puzzle of the same game is the child's own centre "New" control; it only reports `location`.
 *
 * Every message carries { protocol: "ayla-host", v: 1, session, nonce, gameId }. The hub mints a fresh
 * random nonce per iframe instance and puts it, the session ID, the game ID and the starting phase in the
 * iframe URL. Both sides check event.origin AND event.source against the exact expected window/origin,
 * and only ever post to an exact origin (never "*"). Messages never carry URLs that are navigated to.
 */
export const HOST_PROTOCOL = "ayla-host" as const;
export const HOST_PROTOCOL_VERSION = 1 as const;

export type HostPhase = "prepare" | "active";
export type ParentMessageType = "init" | "activate" | "pause" | "prepare";
export type ChildMessageType = "hello" | "ready" | "location" | "next" | "previous" | "back";

export type HostIdentity = { session: string; nonce: string; gameId: string };
type Envelope = { protocol: typeof HOST_PROTOCOL; v: typeof HOST_PROTOCOL_VERSION } & HostIdentity;
export type ParentMessage = Envelope & { type: ParentMessageType };
/** Type step for `next` from games with directional type navigation: +1 = next puzzle type, -1 = previous. */
export type TypeDirection = 1 | -1;
/** `location` reports the child's own path+search so a hub refresh restores the same instance. */
export type ChildMessage = Envelope & { type: ChildMessageType; href?: string; direction?: TypeDirection };
type MessageExtra = { href?: string; direction?: TypeDirection };

/**
 * Games that send their type steps as `next` with `direction` (+1 / -1) instead of `next` / `previous`.
 * Only these may attach `direction` to `next` (the hub treats -1 exactly like `previous`); from every other
 * game the field is ignored.
 */
const TYPE_NAV_GAMES: readonly string[] = ["water"];
export function supportsTypeNavigation(gameId: string | undefined): boolean {
  return gameId !== undefined && TYPE_NAV_GAMES.includes(gameId);
}

const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const PARENT_TYPES: readonly string[] = ["init", "activate", "pause", "prepare"];
const CHILD_TYPES: readonly string[] = ["hello", "ready", "location", "next", "previous", "back"];

export function isHostToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}

export function randomToken(bytes = 16): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}

function envelopeMatches(data: unknown, expected: HostIdentity): data is Envelope & { type: string } {
  if (!data || typeof data !== "object") return false;
  const m = data as Record<string, unknown>;
  return m.protocol === HOST_PROTOCOL && m.v === HOST_PROTOCOL_VERSION && typeof m.type === "string"
    && m.session === expected.session && m.nonce === expected.nonce && m.gameId === expected.gameId;
}

export function makeMessage<T extends ParentMessageType | ChildMessageType>(type: T, identity: HostIdentity, extra: MessageExtra = {}) {
  return { protocol: HOST_PROTOCOL, v: HOST_PROTOCOL_VERSION, type, ...identity, ...extra };
}

/** Child side: accept only a well-formed parent message for exactly this iframe instance. */
export function parseParentMessage(data: unknown, expected: HostIdentity): ParentMessage | null {
  if (!envelopeMatches(data, expected) || !PARENT_TYPES.includes(data.type)) return null;
  return makeMessage(data.type as ParentMessageType, expected);
}

/**
 * Parent side: accept only a well-formed child message for exactly this iframe instance. A `location`
 * href must be a same-game relative path (the game's fixed path), else it is dropped.
 */
export function parseChildMessage(data: unknown, expected: HostIdentity): ChildMessage | null {
  if (!envelopeMatches(data, expected) || !CHILD_TYPES.includes(data.type)) return null;
  const type = data.type as ChildMessageType;
  if (type === "next" && supportsTypeNavigation(expected.gameId) && Object.prototype.hasOwnProperty.call(data, "direction")) {
    const direction = (data as { direction?: unknown }).direction;
    // Exactly +1 or -1; anything else (0, 2, "1", null…) is dropped rather than guessed.
    if (direction !== 1 && direction !== -1) return null;
    return makeMessage(type, expected, { direction });
  }
  if (type !== "location") return makeMessage(type, expected);
  const game = publicGameById(expected.gameId);
  if (!game) return null;
  const fields = data as { href?: unknown; location?: unknown };
  // A present href is always preferred and validated strictly; an invalid href never falls back to an alias.
  const normalized = fields.href !== undefined
    ? (typeof fields.href === "string" ? normalizeGameHref(game, fields.href) : null)
    : legacyTrainLocation(game, fields.location);
  if (!normalized) return null;
  return makeMessage(type, expected, { href: normalized });
}

/**
 * Train bridge (886b444) only: legacy `location` field holding `/adventures?band=…&seed=…&from=commons&level=…`
 * without its fixed `game=trains`. The message envelope has already matched this iframe's verified identity,
 * so the fixed fields are filled from the registered entry and the result passes the same strict href checks.
 */
function legacyTrainLocation(game: PublicGame, raw: unknown): string | null {
  if (game.gameId !== "trains" || typeof raw !== "string") return null;
  if (raw.length > 400 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\s]/.test(raw)) return null;
  let url: URL;
  try { url = new URL(raw, "https://host.invalid"); } catch { return null; }
  if (url.origin !== "https://host.invalid" || url.pathname !== game.path || url.hash) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(game.fixed)) if (!url.searchParams.has(key)) params.set(key, value);
  for (const [key, value] of url.searchParams) params.append(key, value);
  return normalizeGameHref(game, `${url.pathname}?${params.toString()}`);
}

const INSTANCE_PARAMS = ["band", "s", "seed", "t", "from", "all", "b", "o"];
/** Child difficulty level keys (Train reports `level`). Levels are 1–2; a legacy 3 is accepted and normalized to 2. */
const LEVEL_PARAMS = ["l", "lv", "lvl", "level"];
export const MAX_GAME_LEVEL = 2;
const AGE = /^(?:[3-9]|10)$/;
const DEAL = /^\d{1,40}$/;
/** Extra single-valued instance fields allowed only for the named /adventures games (game must equal the fixed value). */
const GAME_FIELDS: Readonly<Record<string, Readonly<Record<string, RegExp>>>> = {
  trains: { game: /^trains$/, age: AGE, deal: DEAL },
  water: { game: /^water$/, age: AGE, deal: DEAL, level: /^[12]$/ },
};

function gameFieldRule(gameId: string, key: string): RegExp | undefined {
  const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  const fields = own(GAME_FIELDS, gameId) ? GAME_FIELDS[gameId] : undefined;
  return fields && own(fields, key) ? fields[key] : undefined;
}

/** A relative href on the game's fixed path whose query only has known instance fields. */
export function isGameRelativeHref(game: PublicGame, href: string): boolean {
  if (href.length > 400 || !href.startsWith("/") || href.startsWith("//") || /[\\\s]/.test(href)) return false;
  let url: URL;
  try { url = new URL(href, "https://host.invalid"); } catch { return false; }
  if (url.origin !== "https://host.invalid" || url.pathname !== game.path || url.hash) return false;
  for (const [key, value] of url.searchParams) {
    const rule = gameFieldRule(game.gameId, key);
    // Game-specific fields (GAME_FIELDS) win; game/age/deal exist only for games that list them.
    if (rule || key === "game" || key === "age" || key === "deal") {
      if (!rule || url.searchParams.getAll(key).length !== 1 || !rule.test(value)) return false;
      if (key === "game" && value !== game.fixed.game) return false;
      continue;
    }
    if (LEVEL_PARAMS.includes(key)) {
      if (url.searchParams.getAll(key).length !== 1 || !/^[1-3]$/.test(value)) return false;
      continue;
    }
    if (!INSTANCE_PARAMS.includes(key) || value.length > 40 || !/^[A-Za-z0-9_-]*$/.test(value)) return false;
  }
  for (const [key, value] of Object.entries(game.fixed)) if (url.searchParams.get(key) !== value) return false;
  return true;
}

/** Validated same-game href with any legacy level 3 rewritten to the current cap (2); null if unsafe. */
export function normalizeGameHref(game: PublicGame, href: string): string | null {
  if (!isGameRelativeHref(game, href)) return null;
  const url = new URL(href, "https://host.invalid");
  let changed = false;
  for (const key of LEVEL_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null && Number(value) > MAX_GAME_LEVEL) { url.searchParams.set(key, String(MAX_GAME_LEVEL)); changed = true; }
  }
  return changed ? `${url.pathname}${url.search}` : href;
}

export type LaunchSpec = {
  origin: string;
  game: PublicGame;
  band: number;
  identity: HostIdentity;
  phase: HostPhase;
  /** Fresh seed for engines that take one; null lets the engine deal its own fresh seed. */
  seed: number | null;
  /** Restore an existing instance (validated relative href reported by that game earlier). */
  resumeHref?: string;
};

/** Builds the iframe URL from fixed registry/game data only. */
export function buildLaunchUrl(spec: LaunchSpec): string {
  const { game } = spec;
  const resume = spec.resumeHref ? normalizeGameHref(game, spec.resumeHref) : null;
  const base = resume ?? game.path;
  const url = new URL(base, spec.origin);
  if (url.origin !== spec.origin) throw new Error("Launch URL left the registered origin");
  if (!resume) {
    for (const [key, value] of Object.entries(game.fixed)) url.searchParams.set(key, value);
    url.searchParams.set("band", String(spec.band));
    if (game.seedParam && spec.seed !== null) url.searchParams.set(game.seedParam, String(spec.seed));
    url.searchParams.set("from", "commons");
  }
  url.searchParams.set("host_session", spec.identity.session);
  url.searchParams.set("host_nonce", spec.identity.nonce);
  url.searchParams.set("host_game", spec.identity.gameId);
  url.searchParams.set("host_phase", spec.phase);
  return url.toString();
}

/** Child side: read the hub's launch identity from the first URL this iframe loaded. */
export function readLaunchIdentity(search: string): (HostIdentity & { phase: HostPhase }) | null {
  const params = new URLSearchParams(search);
  const session = params.get("host_session"), nonce = params.get("host_nonce"), gameId = params.get("host_game");
  const phase = params.get("host_phase");
  if (!isHostToken(session) || !isHostToken(nonce) || !gameId || !publicGameById(gameId)) return null;
  if (phase !== "prepare" && phase !== "active") return null;
  return { session, nonce, gameId, phase };
}

export const HOST_LAUNCH_PARAMS = ["host_session", "host_nonce", "host_game", "host_phase"] as const;
