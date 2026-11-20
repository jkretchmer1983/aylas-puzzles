import { randomToken } from "./protocol";
import { publicGameById } from "./public-games";

/**
 * Hub session model (pure; storage lives in session-store.ts).
 *  - single: menu-card launch. Starts with the chosen game.
 *  - all:    Play all. Starts with a game from a shuffled no-repeat cycle.
 * In BOTH modes the top Next/Previous change the PUZZLE TYPE (a different eligible game); a new puzzle of
 * the same game is the child's own centre "New" control and never goes through the hub.
 * Next: restore a forward entry (after Previous) or promote the one reserved next instance, drawn from the
 * shuffled no-repeat cycle. Previous: restore the last different game from the persisted history (same
 * instance, seed and reported location), else a fresh instance of the previous eligible type.
 * Reserving never marks a game played — only promotion/restoration does. Fresh instances get new IDs/seeds.
 */
export type SessionMode = "single" | "all";
export type SessionInstance = { instanceId: string; gameId: string; seed: number; releaseId: string; href?: string };
export type HubSession = {
  v: 1;
  id: string;
  band: number;
  mode: SessionMode;
  /** single mode: the game the session started with. */
  gameId?: string;
  current: SessionInstance | null;
  reserved: SessionInstance | null;
  /** Games played in the current cycle (current included once promoted/started). */
  seen: string[];
  /** Earlier instances (oldest first) that Previous restores, with their work (href). */
  history: SessionInstance[];
  /** Instances left by Previous (most recent last) that Next restores before dealing a new game. */
  forward: SessionInstance[];
  /**
   * The last instance (with its reported location) of each game this session moved away from. Only a
   * directional type step (supportsTypeNavigation games) returns to a seat; plain Next never uses it.
   */
  seats?: Record<string, SessionInstance>;
};

export type Eligible = { gameId: string; releaseId: string };
type Rand = () => number;
export type StepDirection = "next" | "previous";
/** Persisted type history per direction is bounded. */
export const HISTORY_LIMIT = 12;

export const freshSeed = (rand: Rand = Math.random) => 1 + Math.floor(rand() * 2_000_000_000);

function instance(item: Eligible, rand: Rand): SessionInstance {
  return { instanceId: randomToken(12), gameId: item.gameId, seed: freshSeed(rand), releaseId: item.releaseId };
}

const isEligible = (eligible: readonly Eligible[], gameId: string) => eligible.some((item) => item.gameId === gameId);
const push = (list: readonly SessionInstance[], item: SessionInstance | null) => item ? [...list, item].slice(-HISTORY_LIMIT) : [...list];

/** Next game for a type change: never the current game. Undefined when no OTHER game is eligible. */
export function pickNextGame(eligible: readonly Eligible[], seen: readonly string[], currentId: string | undefined, rand: Rand = Math.random): Eligible | undefined {
  const others = eligible.filter((item) => item.gameId !== currentId);
  if (!others.length) return undefined;
  const unseen = others.filter((item) => !seen.includes(item.gameId));
  const pool = unseen.length ? unseen : others;
  return pool[Math.floor(rand() * pool.length)] ?? pool[0];
}

/** True when the only eligible game is the current one (a type change is impossible). */
export function onlyCurrentEligible(session: HubSession, eligible: readonly Eligible[]) {
  return !!session.current && eligible.length > 0 && eligible.every((item) => item.gameId === session.current?.gameId);
}

export function markSeen(seen: readonly string[], gameId: string, eligible: readonly Eligible[]) {
  const ids = eligible.map((item) => item.gameId);
  const kept = seen.filter((id) => ids.includes(id));
  // Every eligible game has been played this cycle: a new cycle starts with the game now playing.
  if (ids.every((id) => kept.includes(id))) return [gameId];
  return kept.includes(gameId) ? kept : [...kept, gameId];
}

function base(band: number, mode: SessionMode) {
  return { v: 1 as const, id: randomToken(12), band, mode, reserved: null, seen: [] as string[], history: [] as SessionInstance[], forward: [] as SessionInstance[] };
}

export function startSession(band: number, mode: SessionMode, eligible: readonly Eligible[], gameId?: string, rand: Rand = Math.random): HubSession | null {
  if (mode === "single") {
    const item = eligible.find((entry) => entry.gameId === gameId);
    if (!item) return null;
    return { ...base(band, mode), gameId: item.gameId, current: instance(item, rand), seen: [item.gameId] };
  }
  const item = pickNextGame(eligible, [], undefined, rand);
  if (!item) return null;
  return { ...base(band, mode), current: instance(item, rand), seen: [item.gameId] };
}

/**
 * A standalone game host's top arrow arrived (/session?mode=all&game=X&step=…): an all-mode session whose
 * current is a not-yet-loaded fresh instance of X, so the step is relative to X.
 */
export function standaloneSession(band: number, eligible: readonly Eligible[], gameId: string, rand: Rand = Math.random): HubSession {
  const item = eligible.find((entry) => entry.gameId === gameId) ?? { gameId, releaseId: "standalone" };
  return { ...base(band, "all"), current: instance(item, rand), seen: isEligible(eligible, gameId) ? [gameId] : [] };
}

/** Reserve exactly one next instance of a DIFFERENT game. Idempotent: an existing valid reservation is kept. */
export function reserveNext(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession {
  const reserved = session.reserved;
  const valid = reserved && reserved.gameId !== session.current?.gameId && isEligible(eligible, reserved.gameId);
  if (valid) return session;
  const item = pickNextGame(eligible, session.seen, session.current?.gameId, rand);
  return { ...session, reserved: item ? instance(item, rand) : null };
}

/** Next step 1: restore the most recent forward entry of another eligible game (stale/withdrawn ones are skipped). */
export function takeForward(session: HubSession, eligible: readonly Eligible[]): HubSession | null {
  const forward = [...session.forward];
  while (forward.length) {
    const entry = forward.pop()!;
    if (entry.gameId === session.current?.gameId || !isEligible(eligible, entry.gameId)) continue;
    return {
      ...session, current: entry, forward, history: push(session.history, session.current),
      reserved: session.reserved?.gameId === entry.gameId ? null : session.reserved,
      seen: markSeen(session.seen, entry.gameId, eligible),
    };
  }
  return null;
}

/**
 * Next step 2: promote the reserved instance (reusing its ID and seed, so a hidden prepared iframe is
 * reused rather than regenerated). A reservation that is no longer eligible or is the same game is
 * replaced by a fresh pick. Null when no other game is eligible.
 */
export function promoteNext(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession | null {
  const checked = reserveNext(session, eligible, rand);
  const next = checked.reserved;
  if (!next) return null;
  const seats = withSeat(checked.seats, checked.current);
  return {
    ...checked, current: next, reserved: null, seen: markSeen(checked.seen, next.gameId, eligible),
    history: push(checked.history, checked.current), forward: [],
    ...(seats ? { seats } : {}),
  };
}

/** Pure Next: forward entry first, else the reserved/dealt next game. */
export function stepNext(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession | null {
  return takeForward(session, eligible) ?? promoteNext(session, eligible, rand);
}

/**
 * Previous: the last earlier instance of another eligible game (its own seed and saved location), skipping
 * hidden, withdrawn, wrong-age and same-game entries. Without history: a fresh instance of the previous
 * eligible type in catalog order. Null when no other game is eligible.
 */
export function stepPrevious(session: HubSession, eligible: readonly Eligible[], rand: Rand = Math.random): HubSession | null {
  const currentId = session.current?.gameId;
  const history = [...session.history];
  let target: SessionInstance | undefined;
  while (history.length) {
    const entry = history.pop()!;
    if (entry.gameId !== currentId && isEligible(eligible, entry.gameId)) { target = entry; break; }
  }
  if (!target) {
    const others = eligible.filter((item) => item.gameId !== currentId);
    if (!others.length) return null;
    const index = eligible.findIndex((item) => item.gameId === currentId);
    const before = index < 0 ? others[others.length - 1]! : eligible[(index - 1 + eligible.length) % eligible.length]!;
    target = instance(before, rand);
  }
  return {
    ...session, current: target, history, forward: push(session.forward, session.current),
    reserved: session.reserved?.gameId === target.gameId ? null : session.reserved,
    seen: markSeen(session.seen, target.gameId, eligible),
  };
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
 * The session shell routes directional `next` (±1) through stepNext / stepPrevious like every other game's
 * top arrows; this catalog-order step and its seats remain available for directional callers.
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
  const ok = (item: SessionInstance | null) => !!item && isEligible(eligible, item.gameId);
  if (!ok(session.current)) return null;
  return ok(session.reserved) && session.reserved?.gameId !== session.current?.gameId ? session : { ...session, reserved: null };
}

export function withCurrentHref(session: HubSession, instanceId: string, href: string): HubSession {
  if (session.current?.instanceId === instanceId) return { ...session, current: { ...session.current, href } };
  if (session.reserved?.instanceId === instanceId) return { ...session, reserved: { ...session.reserved, href } };
  return session;
}

function parseInstance(v: unknown): SessionInstance | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const i = v as Record<string, unknown>;
  if (typeof i.instanceId !== "string" || !/^[a-f0-9]{24}$/.test(i.instanceId) || typeof i.gameId !== "string" || typeof i.releaseId !== "string") return undefined;
  if (!Number.isInteger(i.seed) || (i.href !== undefined && typeof i.href !== "string")) return undefined;
  return { instanceId: i.instanceId, gameId: i.gameId, seed: Number(i.seed), releaseId: i.releaseId, ...(typeof i.href === "string" ? { href: i.href } : {}) };
}

function parseList(v: unknown): SessionInstance[] | undefined {
  if (v === undefined) return []; // sessions stored before type history existed
  if (!Array.isArray(v)) return undefined;
  const items = v.map(parseInstance);
  return items.every((item): item is SessionInstance => !!item) ? items.slice(-HISTORY_LIMIT) : undefined;
}

/** Strict restore of a stored session (anything malformed is discarded). */
export function parseStoredSession(value: unknown): HubSession | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const current = parseInstance(s.current), reserved = parseInstance(s.reserved);
  const history = parseList(s.history), forward = parseList(s.forward);
  if (s.v !== 1 || typeof s.id !== "string" || !Number.isInteger(s.band) || (s.mode !== "single" && s.mode !== "all")) return null;
  if (current === undefined || reserved === undefined || !Array.isArray(s.seen) || !history || !forward) return null;
  // Seats are optional; a malformed seat is dropped on its own (it never invalidates the session).
  const seats: Record<string, SessionInstance> = {};
  if (s.seats && typeof s.seats === "object" && !Array.isArray(s.seats)) {
    for (const [key, value] of Object.entries(s.seats as Record<string, unknown>).slice(0, SEAT_LIMIT)) {
      const seat = parseInstance(value);
      if (publicGameById(key) && seat && seat.gameId === key && seat.href) seats[key] = seat;
    }
  }
  return {
    v: 1, id: s.id, band: Number(s.band), mode: s.mode, ...(typeof s.gameId === "string" ? { gameId: s.gameId } : {}),
    current, reserved, seen: s.seen.filter((id): id is string => typeof id === "string"), history, forward,
    ...(Object.keys(seats).length ? { seats } : {}),
  };
}
