import { randomToken } from "./protocol";
import { publicGameById } from "./public-games";

/**
 * Hub session model (pure; storage lives in session-store.ts).
 *  - single: menu-card launch. Next = a FRESH instance of the same game.
 *  - all:    Play all. Next = a fresh instance of the next eligible game from a shuffled no-repeat cycle.
 * Exactly one next instance is reserved ahead of time; reserving never marks a game played — only
 * promotion does. Every instance gets a new instance ID and seed; a previous seed is never reused.
 */
export type SessionMode = "single" | "all";
export type SessionInstance = { instanceId: string; gameId: string; seed: number; releaseId: string; href?: string };
export type HubSession = {
  v: 1;
  id: string;
  band: number;
  mode: SessionMode;
  /** single mode: the chosen game. */
  gameId?: string;
  current: SessionInstance | null;
  reserved: SessionInstance | null;
  /** all mode: games played in the current cycle (current included once promoted/started). */
  seen: string[];
  /**
   * The last instance (with its reported location) of each game this session moved away from. Only a
   * directional type step (supportsTypeNavigation games) returns to a seat; plain Next never uses it.
   */
  seats?: Record<string, SessionInstance>;
};

export type Eligible = { gameId: string; releaseId: string };
type Rand = () => number;

export const freshSeed = (rand: Rand = Math.random) => 1 + Math.floor(rand() * 2_000_000_000);

function instance(item: Eligible, rand: Rand): SessionInstance {
  return { instanceId: randomToken(12), gameId: item.gameId, seed: freshSeed(rand), releaseId: item.releaseId };
}

/** all mode: the next game, without mutating the cycle. Avoids an immediate repeat when another game exists. */
export function pickNextGame(eligible: readonly Eligible[], seen: readonly string[], currentId: string | undefined, rand: Rand = Math.random): Eligible | undefined {
  if (!eligible.length) return undefined;
  let pool = eligible.filter((item) => !seen.includes(item.gameId) && item.gameId !== currentId);
  if (!pool.length) pool = eligible.filter((item) => item.gameId !== currentId);
  if (!pool.length) pool = [...eligible];
  return pool[Math.floor(rand() * pool.length)] ?? pool[0];
}

export function markSeen(seen: readonly string[], gameId: string, eligible: readonly Eligible[]) {
  const ids = eligible.map((item) => item.gameId);
  const kept = seen.filter((id) => ids.includes(id));
  // Every eligible game has been played this cycle: a new cycle starts with the game now playing.
  if (ids.every((id) => kept.includes(id))) return [gameId];
  return kept.includes(gameId) ? kept : [...kept, gameId];
}

export function startSession(band: number, mode: SessionMode, eligible: readonly Eligible[], gameId?: string, rand: Rand = Math.random): HubSession | null {
  const base = { v: 1 as const, id: randomToken(12), band, mode, reserved: null, seen: [] as string[] };
  if (mode === "single") {
    const item = eligible.find((entry) => entry.gameId === gameId);
    if (!item) return null;
    return { ...base, gameId: item.gameId, current: instance(item, rand), seen: [item.gameId] };
  }
  const item = pickNextGame(eligible, [], undefined, rand);
  if (!item) return null;
  return { ...base, current: instance(item, rand), seen: [item.gameId] };
}

/** Reserve exactly one next instance. Idempotent: an existing valid reservation is kept. */
export function reserveNext(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession {
  const reserved = session.reserved;
  const valid = reserved && eligible.some((item) => item.gameId === reserved.gameId);
  if (valid) return session;
  let item: Eligible | undefined;
  if (session.mode === "single") item = eligible.find((entry) => entry.gameId === session.gameId);
  else item = pickNextGame(eligible, session.seen, session.current?.gameId, rand);
  return { ...session, reserved: item ? instance(item, rand) : null };
}

/**
 * Promote the reserved instance (reusing its ID and seed, so a hidden prepared iframe is reused rather
 * than regenerated). A reservation that is no longer eligible or whose release changed is replaced by a
 * fresh pick. Returns null when nothing is eligible any more (hub returns to the menu).
 */
export function promoteNext(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession | null {
  const checked = reserveNext(session, eligible, rand);
  const next = checked.reserved;
  if (!next) return null;
  const seen = checked.mode === "all" ? markSeen(checked.seen, next.gameId, eligible) : checked.seen;
  const seats = withSeat(checked.seats, checked.current);
  return { ...checked, current: next, reserved: null, seen, ...(seats ? { seats } : {}) };
}

/** Bounded per game; only an instance that reported its own exact location can be returned to. */
const SEAT_LIMIT = 16;
function withSeat(seats: HubSession["seats"], leaving: SessionInstance | null): HubSession["seats"] {
  if (!leaving?.href) return seats;
  const next: Record<string, SessionInstance> = { ...(seats ?? {}) };
  delete next[leaving.gameId];
  next[leaving.gameId] = leaving;
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - SEAT_LIMIT))) delete next[key];
  return next;
}

export type TypeStep = { session: HubSession; fromReserved: boolean };

/**
 * Directional type navigation (+1 next type, -1 previous type) through the eligible games in their stable
 * catalog order, wrapping around. The arriving type returns to its seat (exact saved location, fresh
 * document) when this session has one, reuses the prepared reservation when it is that type, else starts a
 * fresh instance. The leaving instance is seated so a later step back restores it. Null when there is no
 * other eligible type (the caller keeps the original behaviour).
 */
export function stepSessionType(session: HubSession, eligible: readonly Eligible[], direction: 1 | -1, rand: Rand = Math.random): TypeStep | null {
  const leaving = session.current;
  if (!leaving || (direction !== 1 && direction !== -1) || eligible.length < 2) return null;
  const at = eligible.findIndex((item) => item.gameId === leaving.gameId);
  if (at < 0) return null;
  const target = eligible[(at + direction + eligible.length) % eligible.length];
  if (!target || target.gameId === leaving.gameId) return null;
  const seat = session.seats?.[target.gameId];
  const reserved = session.reserved && eligible.some((item) => item.gameId === session.reserved?.gameId) ? session.reserved : null;
  let arriving: SessionInstance;
  let fromReserved = false;
  if (seat?.href) arriving = { ...seat, instanceId: randomToken(12), releaseId: target.releaseId };
  else if (reserved?.gameId === target.gameId) { arriving = reserved; fromReserved = true; }
  else arriving = instance(target, rand);
  const seats: Record<string, SessionInstance> = { ...(withSeat(session.seats, leaving) ?? {}) };
  delete seats[target.gameId];
  // A reservation of the type now playing would repeat it; it is dropped (and a fresh one reserved later).
  const keptReserved = fromReserved || reserved?.gameId === target.gameId ? null : reserved;
  const seen = session.mode === "all" ? markSeen(session.seen, target.gameId, eligible) : session.seen;
  return { session: { ...session, current: arriving, reserved: keptReserved, seen, seats }, fromReserved };
}

/** Revalidate after a registry/catalog/age change; drops a stale reservation, null if the current game is gone. */
export function revalidateSession(session: HubSession, eligible: readonly Eligible[]): HubSession | null {
  const ok = (item: SessionInstance | null) => !!item && eligible.some((entry) => entry.gameId === item.gameId);
  if (!ok(session.current)) return null;
  return ok(session.reserved) ? session : { ...session, reserved: null };
}

export function withCurrentHref(session: HubSession, instanceId: string, href: string): HubSession {
  if (session.current?.instanceId === instanceId) return { ...session, current: { ...session.current, href } };
  if (session.reserved?.instanceId === instanceId) return { ...session, reserved: { ...session.reserved, href } };
  return session;
}

/** Strict restore of a stored session (anything malformed is discarded). */
export function parseStoredSession(value: unknown): HubSession | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const inst = (v: unknown): SessionInstance | null | undefined => {
    if (v === null) return null;
    if (!v || typeof v !== "object") return undefined;
    const i = v as Record<string, unknown>;
    if (typeof i.instanceId !== "string" || !/^[a-f0-9]{24}$/.test(i.instanceId) || typeof i.gameId !== "string" || typeof i.releaseId !== "string") return undefined;
    if (!Number.isInteger(i.seed) || (i.href !== undefined && typeof i.href !== "string")) return undefined;
    return { instanceId: i.instanceId, gameId: i.gameId, seed: Number(i.seed), releaseId: i.releaseId, ...(typeof i.href === "string" ? { href: i.href } : {}) };
  };
  const current = inst(s.current), reserved = inst(s.reserved);
  if (s.v !== 1 || typeof s.id !== "string" || !Number.isInteger(s.band) || (s.mode !== "single" && s.mode !== "all")) return null;
  if (current === undefined || reserved === undefined || !Array.isArray(s.seen)) return null;
  // Seats are optional; a malformed seat is dropped on its own (it never invalidates the session).
  const seats: Record<string, SessionInstance> = {};
  if (s.seats && typeof s.seats === "object" && !Array.isArray(s.seats)) {
    for (const [key, value] of Object.entries(s.seats as Record<string, unknown>).slice(0, SEAT_LIMIT)) {
      const seat = inst(value);
      if (publicGameById(key) && seat && seat.gameId === key && seat.href) seats[key] = seat;
    }
  }
  return {
    v: 1, id: s.id, band: Number(s.band), mode: s.mode, ...(typeof s.gameId === "string" ? { gameId: s.gameId } : {}),
    current, reserved, seen: s.seen.filter((id): id is string => typeof id === "string"),
    ...(Object.keys(seats).length ? { seats } : {}),
  };
}
