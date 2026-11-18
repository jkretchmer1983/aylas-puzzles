import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getCurrentCatalog, getCurrentRegistry, getManifestStatus, refreshCatalog, useCatalog, useRegistry } from "@/lib/catalog-store";
import { sessionTargets, type SessionTarget } from "./eligibility";
import { buildLaunchUrl, makeMessage, parseChildMessage, randomToken, type HostIdentity, type ParentMessageType } from "./protocol";
import { publicGameById } from "./public-games";
import { promoteNext, reserveNext, revalidateSession, startSession, withCurrentHref, type HubSession, type SessionInstance, type SessionMode } from "./session-queue";
import { readHubSession, saveHubSession } from "./session-store";
import { fetchHostRelease, refreshReservedInstance } from './release-check';

/**
 * The hub session shell: the visible game in a full-viewport iframe plus EXACTLY ONE hidden, inert,
 * silenced iframe preparing the next instance. Promotion reuses that prepared iframe (same React key,
 * same document) instead of regenerating it. At most two iframes exist at any time.
 */
type Frame = { identity: HostIdentity; origin: string; src: string; hello: boolean; ready: boolean; version: Promise<string> };
const READY_TIMEOUT_MS = 20_000;
const REVALIDATE_TIMEOUT_MS = 3_000;
const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

export function SessionShell({ band, mode, gameId }: { band: number; mode: SessionMode; gameId?: string | undefined }) {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const registry = useRegistry();
  const [session, setSessionState] = useState<HubSession | null>(null);
  const [status, setStatus] = useState<"starting" | "playing" | "empty" | "slow">("starting");
  const [readyTick, setReadyTick] = useState(0);
  const [nextError, setNextError] = useState<string>();
  const frames = useRef(new Map<string, Frame>());
  const iframes = useRef(new Map<string, HTMLIFrameElement>());
  const sessionRef = useRef<HubSession | null>(null);
  const busy = useRef(false);

  const setSession = useCallback((next: HubSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    saveHubSession(next);
  }, []);

  const targetsNow = useCallback((): SessionTarget[] => sessionTargets(getCurrentCatalog(), getCurrentRegistry(), band, window.location.origin), [band]);
  const targets = useMemo(() => typeof window === "undefined" ? [] : sessionTargets(catalog, registry, band, window.location.origin), [catalog, registry, band]);

  const backToMenu = useCallback(() => {
    setSession(null);
    void navigate({ to: "/", search: { band } });
  }, [band, navigate, setSession]);

  // Start or restore (refresh keeps the current instance and the already-reserved next one).
  useEffect(() => {
    let cancelled = false;
    void withTimeout(refreshCatalog(true), REVALIDATE_TIMEOUT_MS).then(() => {
      if (cancelled) return;
      const eligible = targetsNow();
      const saved = readHubSession();
      const matches = saved && saved.band === band && saved.mode === mode && (mode === "all" || saved.gameId === gameId);
      const restored = matches ? revalidateSession(saved, eligible) : null;
      const next = restored ?? startSession(band, mode, eligible, gameId);
      if (!next) { setSession(null); setStatus("empty"); return; }
      setSession(next);
      setStatus("starting");
    });
    return () => { cancelled = true; };
  }, [band, mode, gameId, targetsNow, setSession]);

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
    const version = fetchHostRelease(origin, instance.gameId).catch(() => '');
    const frame: Frame = { identity, origin, src, hello: false, ready: false, version };
    frames.current.set(instance.instanceId, frame);
    return frame;
  }, [band, originFor]);

  const send = useCallback((instanceId: string, type: ParentMessageType) => {
    const frame = frames.current.get(instanceId);
    const win = iframes.current.get(instanceId)?.contentWindow;
    if (!frame || !win) return;
    win.postMessage(makeMessage(type, frame.identity), frame.origin);
  }, []);

  const goNext = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || busy.current || !current.current || !frames.current.get(current.current.instanceId)?.ready) return;
    busy.current = true;
    try {
      // Revalidate registry, release and age at the moment of launch.
      const verified = await withTimeout(refreshCatalog(true), REVALIDATE_TIMEOUT_MS);
      if (!verified || getManifestStatus() !== "fresh") throw new Error("Could not verify adventure availability.");
      if (sessionRef.current !== current) return;
      const eligible = targetsNow();
      if (!eligible.some((item) => item.gameId === current.current?.gameId)) { backToMenu(); return; }
      let checked = reserveNext(current, eligible);
      const reserved = checked.reserved;
      if (!reserved) { backToMenu(); return; }
      const target = eligible.find((item) => item.gameId === reserved.gameId);
      if (!target) { backToMenu(); return; }
      const frame = frames.current.get(reserved.instanceId);
      const captured = frame ? await frame.version : '';
      const latest = await fetchHostRelease(target.origin, reserved.gameId);
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
      if (!promoted) { backToMenu(); return; }
      const leaving = current.current?.instanceId;
      if (leaving) { send(leaving, "pause"); frames.current.delete(leaving); iframes.current.delete(leaving); }
      setStatus(promoted.current && frames.current.get(promoted.current.instanceId)?.ready ? "playing" : "starting");
      setNextError(undefined);
      setSession(promoted);
    } catch {
      if (sessionRef.current === current) setNextError('Could not verify the next adventure’s availability or version. Your current puzzle is safe. Tap Retry to try again.');
    } finally {
      busy.current = false;
    }
  }, [backToMenu, send, setSession, targetsNow]);

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
        else if (message.type === "next" && isCurrent) void goNext();
        else if (message.type === "back" && isCurrent) backToMenu();
        return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [backToMenu, goNext, send, setSession]);

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
      <button type="button" onClick={() => void goNext()} className="min-h-12 px-4 font-semibold">Retry</button>
      <button type="button" onClick={() => setNextError(undefined)} className="min-h-12 px-4">Keep playing</button>
    </div>}
    {status !== "playing" && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6" role="status" aria-live="polite">
      <div className="max-w-sm text-center text-foreground">
        {status === "empty" ? <p className="text-lg font-semibold">No adventures are ready for this age yet.</p>
          : status === "slow" ? <p className="text-lg font-semibold">This adventure is taking a while to open.</p>
          : <p className="text-lg font-semibold">Opening your adventure…</p>}
        {status !== "starting" && <div className="mt-4 flex flex-wrap justify-center gap-3">
          {status === "slow" && <button type="button" onClick={retry} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"><RotateCcw className="h-5 w-5" aria-hidden="true" />Try again</button>}
          <button type="button" onClick={backToMenu} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-input bg-background px-5 font-semibold text-foreground"><ArrowLeft className="h-5 w-5" aria-hidden="true" />All games</button>
        </div>}
      </div>
    </div>}
  </main>;
}
