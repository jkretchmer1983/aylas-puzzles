import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getCurrentCatalog, getCurrentRegistry, getManifestStatus, refreshCatalog, useCatalog, useRegistry } from "@/lib/catalog-store";
import { sessionTargets, type SessionTarget } from "./eligibility";
import { buildLaunchUrl, makeMessage, parseChildMessage, randomToken, type HostIdentity, type ParentMessageType } from "./protocol";
import { publicGameById } from "./public-games";
import { onlyCurrentEligible, promoteNext, reserveNext, revalidateSession, standaloneSession, startSession, stepNext, stepPrevious, takeForward, withCurrentHref, type HubSession, type SessionInstance, type SessionMode, type StepDirection } from "./session-queue";
import { consumeStepIntent, readHubSession, saveHubSession, saveStepIntent } from "./session-store";
import { bandById } from "@/lib/public-catalog";
import { fetchHostRelease, refreshReservedInstance } from './release-check';
import { hasCompactSlowRecovery, hasPublishedChildLoader } from './loader-capabilities';
import { REVIEW_RELEASE_UNVERIFIED, reviewTargets } from './review-origins';

/**
 * The hub session shell: the visible game in a full-viewport iframe plus EXACTLY ONE hidden, inert,
 * silenced iframe preparing the next instance (a DIFFERENT game). Promotion reuses that prepared iframe
 * (same React key, same document) instead of regenerating it. At most two iframes exist at any time.
 * Top Next/Previous (child `next`/`previous`) change puzzle type; `back` is Home.
 */
type Frame = { identity: HostIdentity; origin: string; src: string; hello: boolean; ready: boolean; version: Promise<string> };
const READY_TIMEOUT_MS = 20_000;
const REVALIDATE_TIMEOUT_MS = 3_000;
const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

const onlyOneCopy = (band: number) => {
  const range = bandById(band);
  return `This is the only adventure ready for ages ${range.min}–${range.max} right now. Use New inside the game for another puzzle.`;
};

type StandaloneStep = { gameId: string; step: StepDirection };

/**
 * review: the opt-in PRIVATE review harness (/review). Same shell, identity, readiness, release check and
 * two-frame limit; only the child origins come from review-origins.ts, and only on a private QA hub origin.
 */
export function SessionShell({ band, mode, gameId, step, review = false }: { band: number; mode: SessionMode; gameId?: string | undefined; step?: StandaloneStep | undefined; review?: boolean }) {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const registry = useRegistry();
  const [session, setSessionState] = useState<HubSession | null>(null);
  const [status, setStatus] = useState<"starting" | "playing" | "empty" | "slow" | "only-one">("starting");
  const [readyTick, setReadyTick] = useState(0);
  const [nextError, setNextError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const lastStep = useRef<StepDirection>("next");
  const frames = useRef(new Map<string, Frame>());
  const iframes = useRef(new Map<string, HTMLIFrameElement>());
  const sessionRef = useRef<HubSession | null>(null);
  const busy = useRef(false);

  const setSession = useCallback((next: HubSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    saveHubSession(next, review);
  }, [review]);

  const scoped = useCallback((real: SessionTarget[]) => review ? reviewTargets(real, window.location.origin) ?? [] : real, [review]);
  const targetsNow = useCallback((): SessionTarget[] => scoped(sessionTargets(getCurrentCatalog(), getCurrentRegistry(), band, window.location.origin)), [band, scoped]);
  const targets = useMemo(() => typeof window === "undefined" ? [] : scoped(sessionTargets(catalog, registry, band, window.location.origin)), [catalog, registry, band, scoped]);
  // Private previews are auth-walled: in review only, an unreadable version endpoint is recorded as unverified.
  const releaseOf = useCallback((origin: string, id: string) => review ? fetchHostRelease(origin, id).catch(() => REVIEW_RELEASE_UNVERIFIED) : fetchHostRelease(origin, id), [review]);

  const backToMenu = useCallback(() => {
    setSession(null);
    if (review) void navigate({ to: "/review", search: { band } });
    else void navigate({ to: "/", search: { band } });
  }, [band, navigate, review, setSession]);

  // A standalone host's arrow: record it, clean the address bar at once, consume it once below.
  const stepRef = useRef(step);
  useEffect(() => {
    const pending = stepRef.current;
    if (!pending) return;
    stepRef.current = undefined;
    saveStepIntent({ band, ...pending });
    void navigate({ to: "/session", search: { band, mode: "all" }, replace: true });
  }, [band, navigate]);

  // Start or restore (refresh keeps the current instance and the already-reserved next one).
  useEffect(() => {
    let cancelled = false;
    void withTimeout(refreshCatalog(true), REVALIDATE_TIMEOUT_MS).then(() => {
      if (cancelled) return;
      const eligible = targetsNow();
      const saved = readHubSession(review);
      const intent = mode === "all" && !review ? consumeStepIntent(band) : null;
      if (intent) {
        // Relative to the standalone game; reuse this tab's history when it was already playing that game.
        const own = saved && saved.band === band && saved.current?.gameId === intent.gameId ? { ...saved, mode: "all" as const } : null;
        const from = own ?? standaloneSession(band, eligible, intent.gameId);
        const moved = intent.step === "next" ? stepNext(from, eligible) : stepPrevious(from, eligible);
        if (!moved) { setSession(null); setStatus(eligible.length ? "only-one" : "empty"); return; }
        const { gameId: _single, ...rest } = moved;
        setSession(rest);
        setStatus("starting");
        return;
      }
      const matches = saved && saved.band === band && saved.mode === mode && (mode === "all" || saved.gameId === gameId);
      const restored = matches ? revalidateSession(saved, eligible) : null;
      const next = restored ?? startSession(band, mode, eligible, gameId);
      if (!next) { setSession(null); setStatus("empty"); return; }
      setSession(next);
      setStatus("starting");
    });
    return () => { cancelled = true; };
  }, [band, mode, gameId, review, targetsNow, setSession]);

  const originFor = useCallback((instance: SessionInstance) => targetsNow().find((t) => t.gameId === instance.gameId)?.origin
    ?? targets.find((t) => t.gameId === instance.gameId)?.origin, [targets, targetsNow]);

  /** Fixed per instance: the iframe document is never reloaded when it moves from hidden to visible. */
  const frameFor = useCallback((instance: SessionInstance, role: "current" | "reserved"): Frame | null => {
    const existing = frames.current.get(instance.instanceId);
    if (existing) return existing;
    const game = publicGameById(instance.gameId);
    const origin = originFor(instance);
    const s = sessionRef.current;
    if (!game || !origin || !s) return null;
    const identity: HostIdentity = { session: s.id, nonce: randomToken(16), gameId: game.gameId };
    const src = buildLaunchUrl({ origin, game, band, identity, phase: role === "current" ? "active" : "prepare", seed: instance.seed, ...(instance.href ? { resumeHref: instance.href } : {}) });
    // Capture the public version as this document begins loading; a failed check cannot reuse it.
    const version = releaseOf(origin, instance.gameId).catch(() => '');
    const frame: Frame = { identity, origin, src, hello: false, ready: false, version };
    frames.current.set(instance.instanceId, frame);
    return frame;
  }, [band, originFor, releaseOf]);

  const send = useCallback((instanceId: string, type: ParentMessageType) => {
    const frame = frames.current.get(instanceId);
    const win = iframes.current.get(instanceId)?.contentWindow;
    if (!frame || !win) return;
    win.postMessage(makeMessage(type, frame.identity), frame.origin);
  }, []);

  /** Move to a different session state: retire the leaving document and any reservation it invalidated. */
  const switchTo = useCallback((from: HubSession, to: HubSession) => {
    const retire = (id: string | undefined) => { if (!id) return; send(id, "pause"); frames.current.delete(id); iframes.current.delete(id); };
    retire(from.current?.instanceId);
    if (from.reserved && from.reserved.instanceId !== to.reserved?.instanceId && from.reserved.instanceId !== to.current?.instanceId) retire(from.reserved.instanceId);
    setStatus(to.current && frames.current.get(to.current.instanceId)?.ready ? "playing" : "starting");
    setNextError(undefined);
    setNotice(undefined);
    setSession(to);
  }, [send, setSession]);

  /**
   * Previous / forward restore: verify the target's registered origin and actual public version BEFORE
   * leaving the current puzzle (a failure throws, keeping it intact for Retry). The same instance, seed and
   * saved location then load in a fresh document of the latest release.
   */
  const restoreVerified = useCallback(async (from: HubSession, moved: HubSession, eligible: SessionTarget[]) => {
    const target = moved.current;
    const registered = target && eligible.find((item) => item.gameId === target.gameId);
    if (!target || !registered) throw new Error("Restore target is no longer available.");
    const latest = await releaseOf(registered.origin, target.gameId);
    if (sessionRef.current !== from) return;
    frames.current.delete(target.instanceId);
    iframes.current.delete(target.instanceId);
    switchTo(from, { ...moved, current: { ...target, releaseId: latest } });
  }, [releaseOf, switchTo]);

  /** Top Next / Previous: always a DIFFERENT eligible puzzle type, revalidated at the moment of the tap. */
  const goStep = useCallback(async (direction: StepDirection) => {
    const current = sessionRef.current;
    if (!current || busy.current || !current.current || !frames.current.get(current.current.instanceId)?.ready) return;
    busy.current = true;
    lastStep.current = direction;
    try {
      // Revalidate registry, release and age at the moment of launch.
      const verified = await withTimeout(refreshCatalog(true), REVALIDATE_TIMEOUT_MS);
      if (!verified || getManifestStatus() !== "fresh") throw new Error("Could not verify adventure availability.");
      if (sessionRef.current !== current) return;
      const eligible = targetsNow();
      if (!eligible.length) { backToMenu(); return; }
      if (onlyCurrentEligible(current, eligible)) { setNextError(undefined); setNotice(onlyOneCopy(band)); return; }
      if (direction === "previous") {
        const moved = stepPrevious(current, eligible);
        if (!moved) { setNotice(onlyOneCopy(band)); return; }
        await restoreVerified(current, moved, eligible);
        return;
      }
      const restored = takeForward(current, eligible);
      if (restored) { await restoreVerified(current, restored, eligible); return; }
      let checked = reserveNext(current, eligible);
      const reserved = checked.reserved;
      if (!reserved) { setNotice(onlyOneCopy(band)); return; }
      const target = eligible.find((item) => item.gameId === reserved.gameId);
      if (!target) { backToMenu(); return; }
      const frame = frames.current.get(reserved.instanceId);
      const captured = frame ? await frame.version : '';
      const latest = await releaseOf(target.origin, reserved.gameId);
      if (sessionRef.current !== current) return;
      if (frame && (!captured || captured !== latest || frame.origin !== target.origin)) {
        send(reserved.instanceId, 'pause');
        frames.current.delete(reserved.instanceId);
        iframes.current.delete(reserved.instanceId);
        // Force a new document even if the registry already carries the latest ID.
        const fresh = refreshReservedInstance({ ...reserved, releaseId: captured }, latest, () => randomToken(12));
        checked = { ...checked, reserved: fresh };
      } else {
        checked = { ...checked, reserved: { ...reserved, releaseId: latest } };
      }
      const promoted = promoteNext(checked, eligible);
      if (!promoted) { setNotice(onlyOneCopy(band)); return; }
      switchTo(current, promoted);
    } catch {
      if (sessionRef.current === current) setNextError('Could not verify the next adventure’s availability or version. Your current puzzle is safe. Tap Retry to try again.');
    } finally {
      busy.current = false;
    }
  }, [backToMenu, band, releaseOf, restoreVerified, send, switchTo, targetsNow]);

  // Child → parent messages: exact iframe window AND exact registered origin AND exact identity.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      for (const [instanceId, frame] of frames.current) {
        if (event.source !== iframes.current.get(instanceId)?.contentWindow || event.origin !== frame.origin) continue;
        const message = parseChildMessage(event.data, frame.identity);
        if (!message) return;
        const s = sessionRef.current;
        const isCurrent = s?.current?.instanceId === instanceId;
        if (message.type === "hello") { frame.hello = true; send(instanceId, isCurrent ? "activate" : "prepare"); }
        else if (message.type === "ready") { frame.ready = true; setReadyTick((n) => n + 1); }
        else if (message.type === "location" && message.href && s) setSession(withCurrentHref(s, instanceId, message.href));
        // Directional games (supportsTypeNavigation, e.g. water) send their Previous as `next` with direction -1.
        else if (message.type === "next" && isCurrent) void goStep(message.direction === -1 ? "previous" : "next");
        else if (message.type === "previous" && isCurrent) void goStep("previous");
        else if (message.type === "back" && isCurrent) backToMenu();
        return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [backToMenu, goStep, send, setSession]);

  // Activate the visible instance; once its real content is ready, reserve and prepare exactly one next.
  const currentId = session?.current?.instanceId;
  useEffect(() => {
    if (!currentId) return;
    const frame = frames.current.get(currentId);
    if (frame?.hello) send(currentId, "activate");
    if (frame?.ready) {
      setStatus("playing");
      const s = sessionRef.current;
      if (s && !s.reserved) setSession(reserveNext(s, targetsNow()));
    }
  }, [currentId, readyTick, send, setSession, targetsNow]);

  // Bounded wait: a stuck instance offers Try again / Back instead of an endless spinner.
  useEffect(() => {
    if (status !== "starting" || !currentId) return;
    const timer = setTimeout(() => setStatus("slow"), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, currentId]);

  const retry = () => {
    const s = sessionRef.current;
    if (!s?.current) return;
    frames.current.delete(s.current.instanceId);
    iframes.current.delete(s.current.instanceId);
    // Same instance (seed / saved location), fresh document and nonce.
    setSession({ ...s, current: { ...s.current, instanceId: randomToken(12) } });
    setStatus("starting");
  };

  const visible = session?.current ? [{ instance: session.current, role: "current" as const }] : [];
  const hidden = session?.reserved ? [{ instance: session.reserved, role: "reserved" as const }] : [];
  // Stable order by instance ID so promotion never re-parents (and so never reloads) an iframe.
  const slots = [...visible, ...hidden].sort((a, b) => a.instance.instanceId.localeCompare(b.instance.instanceId));
  const currentGameId = publicGameById(session?.current?.gameId ?? "")?.gameId;
  const childOwnsStarting = status === "starting" && hasPublishedChildLoader(currentGameId);
  // Slow stays slow; for approved long loaders with a real current document, recovery is a compact panel.
  const currentFrameExists = !!session?.current && frameFor(session.current, "current") !== null;
  const compactSlow = status === "slow" && currentFrameExists && hasCompactSlowRecovery(currentGameId);

  return <main className="fixed inset-0 overflow-hidden bg-background" aria-label="Puzzle session">
    {slots.map(({ instance, role }) => {
      const frame = frameFor(instance, role);
      if (!frame) return null;
      const isCurrent = role === "current";
      const title = publicGameById(instance.gameId)?.title ?? "Puzzle";
      return <iframe
        key={instance.instanceId}
        ref={(node) => { if (node) iframes.current.set(instance.instanceId, node); }}
        src={frame.src}
        title={isCurrent ? title : `${title} (getting ready)`}
        sandbox={IFRAME_SANDBOX}
        allow="autoplay"
        referrerPolicy="strict-origin"
        onLoad={() => send(instance.instanceId, "init")}
        aria-hidden={isCurrent ? undefined : true}
        tabIndex={isCurrent ? undefined : -1}
        inert={isCurrent ? undefined : true}
        className="absolute inset-0 h-full w-full border-0"
        style={isCurrent ? { zIndex: 1 } : { zIndex: 0, visibility: "hidden", pointerEvents: "none" }}
      />;
    })}
    {nextError && <div className="absolute bottom-4 inset-x-4 z-20 bg-background p-3 text-foreground" role="alert">
      <p>{nextError}</p>
      <button type="button" onClick={() => void goStep(lastStep.current)} className="min-h-12 px-4 font-semibold">Retry</button>
      <button type="button" onClick={() => setNextError(undefined)} className="min-h-12 px-4">Keep playing</button>
    </div>}
    {notice && !nextError && <div className="absolute bottom-4 inset-x-4 z-20 bg-background p-3 text-foreground" role="status" aria-live="polite">
      <p>{notice}</p>
      <button type="button" onClick={() => setNotice(undefined)} className="min-h-12 px-4 font-semibold">Keep playing</button>
    </div>}
    {compactSlow && <div className="absolute z-10 flex w-max max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-input bg-background p-2 text-foreground shadow-lg portrait:bottom-[max(0.5rem,env(safe-area-inset-bottom))] portrait:left-1/2 portrait:-translate-x-1/2 landscape:right-[max(0.5rem,env(safe-area-inset-right))] landscape:top-[max(0.5rem,env(safe-area-inset-top))] landscape:w-36 landscape:flex-col landscape:items-stretch" role="status" aria-live="polite" data-slow-recovery="compact">
      <p className="px-1 text-center text-sm font-semibold">Taking a while…</p>
      <button type="button" onClick={retry} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><RotateCcw className="h-4 w-4" aria-hidden="true" />Try again</button>
      <button type="button" onClick={backToMenu} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All games</button>
    </div>}
    {status !== "playing" && !childOwnsStarting && !compactSlow && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6" role="status" aria-live="polite">
      <div className="max-w-sm text-center text-foreground">
        {status === "empty" ? <p className="text-lg font-semibold">No adventures are ready for this age yet.</p>
          : status === "slow" ? <p className="text-lg font-semibold">This adventure is taking a while to open.</p>
          : status === "only-one" ? <p className="text-lg font-semibold">{onlyOneCopy(band).replace(" Use New inside the game for another puzzle.", "")}</p>
          : <p className="text-lg font-semibold">Opening your adventure…</p>}
        {status !== "starting" && <div className="mt-4 flex flex-wrap justify-center gap-3">
          {status === "only-one" && typeof window !== "undefined" && window.history.length > 1 && <button type="button" onClick={() => window.history.back()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"><ArrowLeft className="h-5 w-5" aria-hidden="true" />Back to my puzzle</button>}
          {status === "slow" && <button type="button" onClick={retry} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"><RotateCcw className="h-5 w-5" aria-hidden="true" />Try again</button>}
          <button type="button" onClick={backToMenu} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-input bg-background px-5 font-semibold text-foreground"><ArrowLeft className="h-5 w-5" aria-hidden="true" />All games</button>
        </div>}
      </div>
    </div>}
  </main>;
}
