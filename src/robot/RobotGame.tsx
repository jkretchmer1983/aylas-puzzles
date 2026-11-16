import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Lightbulb, PackageCheck, Play, RotateCcw, Settings, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BANDS } from "@/gen/templates";
import { newSeed } from "@/gen/rng";
import { ensureStory, subscribeStory } from "@/lib/story-cache";
import { ensureArt, subscribeArt } from "@/lib/art-cache";
import { instanceContentKey } from "@/lib/instance-content";
import { ReadAloud } from "@/components/ReadAloud";
import depot from "@/assets/robot/desert-postal-depot-clean.jpg";
import { generateRobotMission } from "./generator";
import { createRobotState, expandProgram, nextPose, collisionAt, robotReducer } from "./engine";
import { robotBinding, robotArtPrompt } from "./themes";
import { ProgramRail } from "./ProgramRail";
import { RobotScene, type RobotVisualPose } from "./RobotScene";
import { playRobotSound, setRobotSoundEnabled } from "./audio";
import { readRobotSession, robotSessionKey, saveRobotSession } from "./session";
import type { RobotPhase, RobotState } from "./types";

export type RobotSearch = { band: number; s?: number | undefined; b?: number | undefined };
type CompleteSearch = { band: number; s: number; b?: number | undefined };
type FrozenRobotStory = { title: string; story: string; imagePrompt: string };
type HistoryEntry = CompleteSearch;

const HISTORY_KEY = "robot-history:v1";
function readHistory(): HistoryEntry[] {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]") as HistoryEntry[]; } catch { return []; }
}
function writeHistory(entries: HistoryEntry[]) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-24))); } catch { /* private mode */ }
}
function visualFor(pose: { x: number; y: number; direction: number }, size: number): RobotVisualPose {
  return { x: pose.x - (size - 1) / 2, y: pose.y - (size - 1) / 2, direction: pose.direction, wheelSpin: 0, pitch: 0, speed: 0 };
}

export function RobotGame({ band, instanceSeed, boardSeed, navigate }: {
  band: number;
  instanceSeed: number;
  boardSeed: number;
  navigate: (search: RobotSearch, replace?: boolean) => void;
}) {
  const binding = useMemo(() => robotBinding(instanceSeed, band), [instanceSeed, band]);
  const mission = useMemo(() => generateRobotMission(boardSeed, band, binding), [boardSeed, band, binding]);
  const sessionKey = robotSessionKey(band, instanceSeed, boardSeed);
  const [state, dispatch] = useReducer(robotReducer, mission, currentMission => {
    const base = createRobotState(currentMission);
    const saved = readRobotSession(sessionKey);
    if (!saved) return base;
    return {
      ...base, program: saved.program, pose: saved.pose, delivered: saved.delivered,
      phase: saved.phase === "running" ? "editing" : saved.phase,
      message: saved.phase === "running" ? "Run paused when you left. Your program is safe." : saved.message,
    };
  });
  const [started, setStarted] = useState(() => readRobotSession(sessionKey)?.started ?? false);
  const [story, setStory] = useState<FrozenRobotStory>({ title: binding.title, story: binding.story, imagePrompt: "Pip and the exact mission parcels at the desert postal depot." });
  const [storySettled, setStorySettled] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [art, setArt] = useState<{ src: string | null; final: boolean }>({ src: null, final: false });
  const [historyCount, setHistoryCount] = useState(() => readHistory().length);
  const [sound, setSound] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const visualPose = useRef<RobotVisualPose>(visualFor(mission.start, mission.size));
  const stateRef = useRef<RobotState>(state);
  stateRef.current = state;
  const steps = expandProgram(state.program);
  const activeTokenId = state.phase === "running" ? steps[state.cursor]?.tokenId ?? null : null;
  const storyKey = `${binding.instanceId}:story`;
  const generatorIntro = useMemo(() => `${binding.story} Today’s load: ${mission.stops.map(stop => `${stop.subject.parcel} for ${stop.subject.destination}`).join("; ")}.`, [binding.story, mission.stops]);
  const storyInput = useMemo(() => ({
    age: BANDS[band]?.max ?? 8,
    theme: `A friendly cream-and-orange postal robot in a red-rock canyon; ${binding.themeId}; exact parcels and destinations: ${mission.stops.map(s => `${s.subject.parcel} to ${s.subject.destination}`).join(", ")}`,
    title: binding.title,
    story: generatorIntro,
    task: `${binding.mission}${mission.ordered ? " Deliver in the numbered order." : ""}`,
  }), [band, binding, generatorIntro, mission.ordered, mission.stops]);

  useEffect(() => {
    if (started) return;
    const update = () => {
      const entry = ensureStory(storyKey, storyInput);
      if (!entry.settled) return;
      if (entry.title && entry.story) {
        const coordinated = mission.stops.every(stop => {
          const text = `${entry.title} ${entry.story}`.toLowerCase();
          return text.includes(stop.subject.parcel.toLowerCase()) && text.includes(stop.subject.destination.toLowerCase());
        });
        if (coordinated) setStory({ title: entry.title, story: entry.story, imagePrompt: (entry as typeof entry & { imagePrompt?: string }).imagePrompt ?? "Illustrate the exact frozen story." });
      }
      setStorySettled(true);
    };
    update();
    return subscribeStory(storyKey, update);
  }, [storyKey, storyInput, started, mission.stops]);

  useEffect(() => {
    if (!started && !storySettled) return;
    const key = `${binding.instanceId}:art:${story.title}`;
    const prompt = robotArtPrompt(story.title, story.story, story.imagePrompt);
    const update = () => {
      const entry = ensureArt(key, prompt);
      setArt({ src: entry.src, final: entry.final });
    };
    update();
    return subscribeArt(key, update);
  }, [binding.instanceId, story, started, storySettled]);

  useEffect(() => {
    try {
      const soundOn = localStorage.getItem("robot-sound") !== "off";
      setSound(soundOn); setRobotSoundEnabled(soundOn);
      const motionSetting = localStorage.getItem("robot-motion");
      setReducedMotion(motionSetting ? motionSetting === "reduced" : window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch { setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  }, []);

  useEffect(() => {
    saveRobotSession(sessionKey, {
      started, program: state.program, phase: state.phase === "running" ? "editing" : state.phase,
      pose: state.pose, delivered: state.delivered, message: state.message,
    });
  }, [sessionKey, started, state.program, state.phase, state.pose, state.delivered, state.message]);

  useEffect(() => {
    if (state.phase === "running" && state.cursor === 0) visualPose.current = visualFor(mission.start, mission.size);
  }, [state.runId, state.phase, state.cursor, mission.start, mission.size]);

  const runSchedule = useRef<{ token: number; timers: number[] }>({ token: 0, timers: [] });
  const cancelScheduledRun = useCallback(() => {
    runSchedule.current.token += 1;
    runSchedule.current.timers.forEach(window.clearTimeout);
    runSchedule.current.timers = [];
  }, []);
  useEffect(() => () => cancelScheduledRun(), [sessionKey, cancelScheduledRun]);

  // Run owns one bounded macrotask schedule. Rerenders, animation frames and
  // WebGL cannot cancel it; stop/reset/navigation invalidate its token.
  const startRun = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === "running" || !current.program.length) { dispatch({ type: "run" }); return; }
    cancelScheduledRun();
    const scheduleToken = runSchedule.current.token;
    const runId = current.runId + 1;
    const scheduledSteps = expandProgram(current.program).slice(0, mission.maxTokens * 3);
    dispatch({ type: "run" });
    let elapsed = 0;
    let scheduledPose = mission.start;
    scheduledSteps.forEach((step, cursor) => {
      const next = nextPose(scheduledPose, step.op);
      const collision = step.op === "forward" ? collisionAt(mission, next) : null;
      const duration = reducedMotion ? 32 : step.op === "forward" ? (collision ? 380 : 520) : 360;
      if (!collision) scheduledPose = next;
      elapsed += duration;
      runSchedule.current.timers.push(window.setTimeout(() => {
        const latest = stateRef.current;
        if (runSchedule.current.token === scheduleToken && latest.runId === runId) {
          // The reducer checks phase/cursor/runId again when queued actions are
          // applied, so a slow render cannot drop or double-commit a step.
          dispatch({ type: "commit", runId, cursor });
        }
      }, elapsed));
    });
  }, [cancelScheduledRun, mission, reducedMotion]);

  // This effect only draws the current step. It never commits engine actions.
  useEffect(() => {
    if (!started || state.phase !== "running") return;
    const step = expandProgram(state.program)[state.cursor];
    if (!step) return;
    const from = { ...visualPose.current };
    const targetPose = nextPose(state.pose, step.op);
    const collision = step.op === "forward" ? collisionAt(mission, targetPose) : null;
    const target = visualFor(targetPose, mission.size);
    let directionDelta = step.op === "left" ? -1 : step.op === "right" ? 1 : 0;
    if (step.op === "forward") directionDelta = 0;
    if (collision) {
      target.x = from.x + (target.x - from.x) * .34;
      target.y = from.y + (target.y - from.y) * .34;
    }
    let cancelled = false;
    playRobotSound(collision ? "brake" : step.op === "forward" ? "move" : "turn");
    if (reducedMotion) {
      visualPose.current = { ...target, wheelSpin: from.wheelSpin, pitch: 0, speed: 0 };
      return () => { cancelled = true; };
    }
    const duration = step.op === "forward" ? (collision ? 360 : 500) : 340;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const raw = Math.min(1, (now - start) / duration);
      const t = raw < .5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      visualPose.current = {
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t,
        direction: from.direction + directionDelta * t,
        wheelSpin: from.wheelSpin + (step.op === "forward" ? t * Math.PI * 2.4 : 0),
        pitch: step.op === "forward" ? Math.sin(raw * Math.PI) * (collision ? .12 : -.065) : 0,
        speed: Math.sin(raw * Math.PI),
      };
      if (raw < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [started, state.phase, state.cursor, state.runId, state.program, state.pose, mission, reducedMotion]);

  const previousPhase = useRef<RobotPhase>(state.phase);
  useEffect(() => {
    if (state.lastDelivery) playRobotSound("deliver");
    if (state.phase === "success" && previousPhase.current !== "success") playRobotSound("success");
    previousPhase.current = state.phase;
  }, [state.eventNonce, state.lastDelivery, state.phase]);

  const currentSearch = useCallback((): CompleteSearch => ({ band, s: instanceSeed, b: boardSeed }), [band, instanceSeed, boardSeed]);
  const pushCurrent = useCallback(() => {
    const history = [...readHistory(), currentSearch()];
    writeHistory(history); setHistoryCount(history.length);
  }, [currentSearch]);
  const goNext = useCallback(() => { pushCurrent(); navigate({ band, s: newSeed() }); }, [band, navigate, pushCurrent]);
  const goNew = useCallback(() => {
    pushCurrent();
    const nextBoard = newSeed();
    const nextMission = generateRobotMission(nextBoard, band, binding);
    saveRobotSession(robotSessionKey(band, instanceSeed, nextBoard), {
      started: true, program: [], phase: "editing", pose: nextMission.start, delivered: [], message: "New board, same story. Build a fresh route!",
    });
    navigate({ band, s: instanceSeed, b: nextBoard });
  }, [band, instanceSeed, binding, navigate, pushCurrent]);
  const goPrevious = useCallback(() => {
    const history = readHistory();
    const previous = history.pop();
    if (!previous) return;
    writeHistory(history); setHistoryCount(history.length); navigate(previous);
  }, [navigate]);
  const changeAge = (nextBand: number) => { pushCurrent(); navigate({ band: nextBand, s: newSeed() }); };
  const primary = () => {
    if (state.phase === "success") goNext();
    else if (state.phase === "running") { cancelScheduledRun(); dispatch({ type: "stop" }); }
    else startRun();
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, select, textarea")) return;
      if (event.key === "Escape") { dispatch({ type: "stop" }); setStoryOpen(false); setSettingsOpen(false); return; }
      if (!started) return;
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === "f") { event.preventDefault(); dispatch({ type: "add", op: "forward" }); }
      if (event.key.toLowerCase() === "l") { event.preventDefault(); dispatch({ type: "add", op: "left" }); }
      if (event.key.toLowerCase() === "r") { event.preventDefault(); dispatch({ type: "add", op: "right" }); }
      if (event.key === "Enter" && !target?.closest("button, a")) { event.preventDefault(); primary(); }
      if (event.key === "Backspace" && !target?.closest(".robot-command-token")) { event.preventDefault(); dispatch({ type: "remove", index: stateRef.current.program.length - 1 }); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [started, primary]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = {
      get state() { return stateRef.current; },
      get visualPose() { return visualPose.current; },
      dispatch,
      loadWitness: () => dispatch({ type: "load", program: mission.witness }),
      run: startRun,
      stop: () => { cancelScheduledRun(); dispatch({ type: "stop" }); },
      reset: () => { cancelScheduledRun(); dispatch({ type: "reset" }); },
      newBoard: goNew,
      next: goNext,
      previous: goPrevious,
    };
    (window as unknown as { __robot?: typeof debug }).__robot = debug;
    return () => { delete (window as unknown as { __robot?: typeof debug }).__robot; };
  }, [mission.witness, goNew, goNext, goPrevious, startRun, cancelScheduledRun]);

  const toggleSound = () => {
    const value = !sound; setSound(value); setRobotSoundEnabled(value);
    try { localStorage.setItem("robot-sound", value ? "on" : "off"); } catch { /* private mode */ }
    if (value) playRobotSound("pickup");
  };
  const toggleMotion = () => {
    const value = !reducedMotion; setReducedMotion(value);
    try { localStorage.setItem("robot-motion", value ? "reduced" : "full"); } catch { /* private mode */ }
  };
  const spoken = `${story.title}. ${story.story} ${binding.mission} ${mission.ordered ? "Deliver the parcels in numbered order." : ""}`;
  const primaryLabel = state.phase === "running" ? "Stop route" : state.phase === "failure" ? "Try again" : state.phase === "success" ? "Next puzzle" : "Run route";

  return <main className={`robot-game robot-phase-${state.phase} ${reducedMotion ? "robot-reduced-motion" : ""}`}>
    <header className="robot-header">
      <Link to="/" search={{ pick: undefined }} className="robot-round-control robot-back" aria-label="Back to adventure selection"><ArrowLeft aria-hidden="true" /></Link>
      <div className="robot-title-banner"><span>Ayla’s Puzzles</span><h1>The Robot Took a Shortcut</h1><i aria-hidden="true" /></div>
      <label className="robot-age-select"><span className="sr-only">Choose robot age range</span><select aria-label="Robot age range" value={band} onChange={e => changeAge(Number(e.target.value))}>{[4, 5, 6].map(id => <option key={id} value={id}>{BANDS[id]?.label}</option>)}</select><ChevronDown aria-hidden="true" /></label>
      <div className="robot-delivery-progress" aria-label={`${state.delivered.length} of ${mission.stops.length} parcels delivered`}>
        {mission.stops.map(stop => <span key={stop.id} className={state.delivered.includes(stop.id) ? "done" : ""}>{state.delivered.includes(stop.id) ? <Check aria-hidden="true" /> : null}</span>)}
      </div>
      <button className="robot-round-control robot-sound" onClick={toggleSound} aria-label={sound ? "Mute game sounds" : "Turn on game sounds"}>{sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}</button>
    </header>

    <section className="robot-mission-sign" aria-label="Mission and story controls">
      <div className="robot-mission-copy"><PackageCheck aria-hidden="true" /><p>{binding.mission} <strong>{state.delivered.length}/{mission.stops.length}</strong></p></div>
      <div className="robot-mission-actions">
        <button aria-label="Story" onClick={() => setStoryOpen(true)}><BookOpen aria-hidden="true" /><span>Story</span></button>
        <ReadAloud text={spoken} label="robot story and instructions" />
        <button aria-label="Hint" onClick={() => setHintOpen(value => !value)} aria-expanded={hintOpen}><Lightbulb aria-hidden="true" /><span>Hint</span></button>
        <button aria-label="Settings" onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen}><Settings aria-hidden="true" /><span>Settings</span></button>
      </div>
      {settingsOpen && <div className="robot-settings-panel">
        <strong>Game settings</strong>
        <button onClick={toggleSound}>{sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />} Sounds {sound ? "on" : "off"}</button>
        <button onClick={toggleMotion}>Reduced motion {reducedMotion ? "on" : "off"}</button>
        <button onClick={() => { setStoryOpen(true); setSettingsOpen(false); }}><BookOpen aria-hidden="true" /> Replay story</button>
      </div>}
    </section>

    <section className="robot-yard" aria-label="Desert postal depot puzzle">
      <img className="robot-depot-art" src={depot} alt="A sunny red-rock canyon postal depot with a stone delivery yard" draggable={false} />
      <RobotScene mission={mission} pose={visualPose} delivered={state.delivered} phase={state.phase} lastDelivery={state.lastDelivery} eventNonce={state.eventNonce} reducedMotion={reducedMotion} />
      <div className="robot-stop-list" aria-label="Parcel destinations">
        {mission.stops.map((stop, index) => <div key={stop.id} className={state.delivered.includes(stop.id) ? "delivered" : ""}>
          <span aria-hidden="true">{state.delivered.includes(stop.id) ? "✓" : stop.subject.icon}</span>
          <p><small>{mission.ordered ? `${index + 1}. ` : ""}{stop.subject.parcel}</small><strong>{stop.subject.destination}</strong></p>
        </div>)}
      </div>
      {hintOpen && <div className="robot-hint" role="status"><Lightbulb aria-hidden="true" /><p>{mission.ordered ? "Follow the stop numbers. A repeat block can save space when the same command appears again." : "Find the first yellow pad. Turn Pip before moving forward; watch where the wheels point."}</p><button onClick={() => setHintOpen(false)} aria-label="Close hint"><X aria-hidden="true" /></button></div>}
      {state.phase === "success" && <div className="robot-confetti" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * .07}s`, ["--robot-confetti-turn" as string]: `${i * 47}deg` }} />)}</div>}
    </section>

    <section className="robot-control-deck">
      <aside className="robot-landscape-story"><span className="robot-story-kicker">POSTAL ADVENTURE</span><h2>{story.title}</h2><p>{story.story}</p></aside>
      <ProgramRail program={state.program} maxTokens={mission.maxTokens} allowsRepeat={mission.allowsRepeat} phase={state.phase} activeTokenId={activeTokenId} dispatch={dispatch} />
      <button className={`robot-primary-action ${state.phase}`} onClick={primary} disabled={!started || (!state.program.length && state.phase !== "success" && state.phase !== "running")}>
        {state.phase === "running" ? <Square aria-hidden="true" /> : state.phase === "success" ? <ArrowRight aria-hidden="true" /> : <Play aria-hidden="true" />}<span>{primaryLabel}</span>
      </button>
      <button className="robot-reset-action" onClick={() => { cancelScheduledRun(); dispatch({ type: "reset" }); }}><RotateCcw aria-hidden="true" /><span>Reset</span></button>
    </section>

    <div className={`robot-feedback ${state.phase}`} role="status" aria-live="polite"><span>{state.message}</span></div>
    <nav className="robot-navigation" aria-label="Puzzle navigation">
      <button onClick={goPrevious} disabled={!historyCount}><ArrowLeft aria-hidden="true" /> Previous</button>
      <button onClick={goNew}><RotateCcw aria-hidden="true" /> New</button>
      <button onClick={goNext}>Next <ArrowRight aria-hidden="true" /></button>
    </nav>

    {storyOpen && <aside className="robot-story-panel" aria-label="Story replay">
      <button className="robot-story-close" onClick={() => setStoryOpen(false)} aria-label="Close story"><X aria-hidden="true" /></button>
      <div className="robot-story-art">{art.src ? <img src={art.src} alt="Story illustration of Pip and this mission’s parcels" className={art.final ? "final" : "preview"} /> : <img src={depot} alt="The desert postal depot" />}</div>
      <div><span className="robot-story-kicker">POSTAL ADVENTURE</span><h2>{story.title}</h2><p>{story.story}</p><p><strong>Your mission:</strong> {binding.mission}{mission.ordered ? " Follow the numbers on the pads." : ""}</p><ReadAloud text={spoken} label="story"> <span>Listen</span></ReadAloud></div>
    </aside>}

    {!started && <section className="robot-intro" aria-label="Adventure introduction">
      <div className="robot-intro-card">
        <span className="robot-intro-stamp" aria-hidden="true">🤖</span>
        <p className="robot-story-kicker">A NEW POSTAL ADVENTURE</p>
        <h2>The Robot Took a Shortcut</h2>
        <p>{story.story}</p>
        <div className="robot-intro-load">{mission.stops.map((stop, i) => <span key={stop.id} title={`${stop.subject.parcel} to ${stop.subject.destination}`}><i aria-hidden="true">{stop.subject.icon}</i><small>{stop.subject.destination}</small>{mission.ordered ? <b>{i + 1}</b> : null}</span>)}</div>
        <p className="robot-intro-mission">{binding.mission}</p>
        <button className="robot-start-button" onClick={() => { setStarted(true); setStoryOpen(false); playRobotSound("deliver"); }}><Play aria-hidden="true" /> Start delivery</button>
        <small>{storySettled ? "Your story is ready." : "Story painter is thinking… you can start with the offline story."}</small>
      </div>
    </section>}
  </main>;
}
