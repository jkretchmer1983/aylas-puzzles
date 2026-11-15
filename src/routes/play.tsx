import { WorldBackdrop, worldFor } from "@/gen/PuzzleWorld";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";
import { newSeed } from "@/gen/rng";
import { PuzzleBody } from "@/gen/Renderer";
import { tierFor, useProgress } from "@/lib/progress";
import { drawTemplate } from "@/gen/deck";
import { PuzzleDrawing } from "@/gen/PuzzleDrawing";
import { imagePrompt } from "@/gen/drawing";
import { ensureArt, subscribeArt } from "@/lib/art-cache";
import { ensureStory, subscribeStory } from "@/lib/story-cache";
import { DRAWING_THEMES } from "@/gen/drawing";
import { ArrowLeft, ArrowRight, ChevronDown, Lightbulb, RotateCcw, Settings, Puzzle, BookOpen } from "lucide-react";
import { WoodenActionButton, WoodenTitleSign } from "@/gen/ForestObjects";
import { StoryIllustrationFrame } from "@/gen/StoryIllustrationFrame";
import { Button } from "@/components/ui/button";
import { VictoryRibbon } from "@/components/VictoryRibbon";
import { ReadAloud } from "@/components/ReadAloud";
import { readPuzzleSession, savePuzzleSession } from "@/lib/puzzle-session";
import expandedForest from "@/assets/forest-game/forest-carved-reference.jpg";
import introForest from "@/assets/forest-game/forest-expanded.jpg";
import offlineIllustration from "@/assets/forest-game/story-fallback-reference.jpg";

type Search = { band: number; t?: string | undefined; s?: number | undefined };

export const Route = createFileRoute("/play")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    band: Math.min(6, Math.max(0, Number(s.band) || 0)),
    t: typeof s.t === "string" ? s.t : undefined,
    s: s.s ? Number(s.s) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Play — Puzzle Quest" },
      { name: "description", content: "Solve a fresh logic puzzle made just for your age." },
      { property: "og:title", content: "Play — Puzzle Quest" },
      { property: "og:description", content: "Solve a fresh logic puzzle made just for your age." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Play,
});


/** Fit the reference composition with one uniform scale; never stretch its artwork. */
function ForestViewport({ children, intro }: { children: ReactNode; intro: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / 393, height / 852));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={viewport} className="forest-viewport" style={{ ["--forest-scale" as string]: scale }}>
    <img className="forest-viewport-scenery" src={intro ? introForest : expandedForest} alt="" aria-hidden="true" draggable={false} />
    {children}
  </div>;
}

function PuzzleStage({ children, spatial }: { children: ReactNode; spatial: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    const fit = () => {
      if (spatial) return setScale(1);
      if (!window.matchMedia("(max-width: 1024px)").matches) return setScale(1);
      setScale(Math.min(1, outer.clientHeight / Math.max(1, inner.offsetHeight), outer.clientWidth / Math.max(1, inner.scrollWidth)));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(outer); ro.observe(inner);
    window.addEventListener("resize", fit);
    fit();
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [spatial]);
  return <div ref={frame} className="puzzle-stage"><div ref={content} className="puzzle-stage-content" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}

function Confetti({ burst }: { burst: number }) {
  const [bits, setBits] = useState<{ x: number; d: number; c: string; r: number }[]>([]);
  useEffect(() => {
    if (!burst) return;
    const cs = ["var(--sun)", "var(--berry)", "var(--sky)", "var(--leaf)", "var(--primary)"];
    setBits(Array.from({ length: 60 }, () => ({ x: Math.random() * 100, d: Math.random() * 0.6, c: cs[Math.floor(Math.random() * cs.length)] ?? "var(--sun)", r: Math.random() * 720 - 360 })));
    const t = setTimeout(() => setBits([]), 2600);
    return () => clearTimeout(t);
  }, [burst]);
  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.x}%`, background: b.c, animationDelay: `${b.d}s`, ["--r" as string]: `${b.r}deg` }} />)}</div>;
}

function Play() {
  const { band, t, s } = Route.useSearch();
  const nav = useNavigate({ from: "/play" });
  const [progress, update] = useProgress();
  const [result, setResult] = useState<{ ok: boolean; n: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [party, setParty] = useState(0);
  const trail = useRef<Search[]>([]);
  const mainRef = useRef<HTMLElement>(null);

  const pickNext = useCallback((exclude?: string) => {
    return { band, t: drawTemplate(band, templatesFor(band).map((x) => x.id), exclude), s: newSeed() };
  }, [band]);

  // Fill in a puzzle when the address has none.
  useEffect(() => {
    if (!t || !s || !templatesFor(band).some((x) => x.id === t)) nav({ search: pickNext(), replace: true });
  }, [t, s, band, nav, pickNext]);

  const spec = t && s ? generate(t, band, s) : null;
  const key = `${band}-${t}-${s}`;
  const [storyOpen, setStoryOpen] = useState(true);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const saved = readPuzzleSession(key);
    setStarted(!!saved.started);
    setStoryOpen(!saved.started);
    setResult(saved.result === undefined ? null : { ok: saved.result, n: 1 });
    setHint(false);
    window.speechSynthesis?.cancel();
  }, [key]);
  const beginPuzzle = () => {
    savePuzzleSession(key, { started: true });
    setStarted(true);
    setStoryOpen(false);
    window.speechSynthesis?.cancel();
  };
  useEffect(() => { window.speechSynthesis?.cancel(); window.dispatchEvent(new Event("forest-speech-stop")); }, [storyOpen]);
  const [loading, setLoading] = useState(true);
  const [art, setArt] = useState<{ src: string; final: boolean } | null>(null);
  const [artSettled, setArtSettled] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  useEffect(() => {
    if (!t || !s) return;
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 1100);
    return () => clearTimeout(id);
  }, [t, s]);

  // Rich AI storyline: the loader waits for it, then the text is frozen for the whole puzzle.
  const storyInput = (sp: NonNullable<typeof spec>) => ({ age: band + 4, theme: DRAWING_THEMES[sp.template as keyof typeof DRAWING_THEMES] ?? sp.template, title: sp.title, story: sp.story, task: sp.task });
  const [storySettled, setStorySettled] = useState(false);
  const [shown, setShown] = useState<{ key: string; title: string; story: string } | null>(null);
  useEffect(() => {
    if (!spec) return;
    setStorySettled(false);
    const entry = ensureStory(key, storyInput(spec));
    const upd = () => { if (entry.settled) setStorySettled(true); };
    upd();
    return subscribeStory(key, upd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loaderDone = !loading && artSettled && storySettled;
  useEffect(() => {
    if (!loaderDone || t !== "sudoku") return;
    const target = mainRef.current?.querySelector<HTMLElement>(storyOpen ? '.story-title-plaque h1' : '.puzzle-task');
    if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }, [loaderDone, storyOpen, t]);
  useEffect(() => {
    if (!spec || !storySettled || shown?.key === key) return;
    const e = ensureStory(key, storyInput(spec));
    setShown({ key, title: e.title ?? spec.title, story: e.story ?? spec.story });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storySettled, key]);

  // Rich AI scene art streams in over the instant drawing; offline or on failure the drawing stays.
  // The picture was usually already painted while the previous puzzle was being solved.
  useEffect(() => {
    if (!spec) return;
    setArt(null);
    setArtSettled(false);
    setImageReady(false);
    const entry = ensureArt(key, imagePrompt(spec.title, spec.story, band));
    const update = () => {
      setArt(entry.src ? { src: entry.src, final: entry.final } : null);
      if (entry.settled) setArtSettled(true);
    };
    update();
    const unsub = subscribeArt(key, update);
    // The loader gives up waiting after a while, but the picture still fades in whenever it finishes.
    const giveUp = setTimeout(() => setArtSettled(true), 12000);
    return () => { unsub(); clearTimeout(giveUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Pick the next puzzle now and start painting its picture while this one is being solved.
  const nextRef = useRef<Search | null>(null);
  useEffect(() => {
    if (!spec) return;
    const next = pickNext(t);
    nextRef.current = next;
    if (next.t && next.s) {
      const ns = generate(next.t, band, next.s);
      ensureStory(`${band}-${next.t}-${next.s}`, storyInput(ns));
      ensureArt(`${band}-${next.t}-${next.s}`, imagePrompt(ns.title, ns.story, band), key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const report = useCallback((ok: boolean) => {
    setResult((r) => ({ ok, n: (r?.n ?? 0) + 1 }));
    const wasSolved = readPuzzleSession(key).awarded === true;
    if (t === "sudoku") savePuzzleSession(key, { result: ok, awarded: wasSolved || ok });
    if (ok && !wasSolved) {
      setParty((p) => p + 1);
      update((p) => { const streak = p.streak + 1; return { ...p, solved: p.solved + 1, streak, best: Math.max(p.best, streak) }; });
    } else if (!ok) update((p) => ({ ...p, streak: 0 }));
  }, [update, key, t]);

  const reset = () => { setResult(null); setHint(false); };
  const goNext = () => { trail.current.push({ band, t, s }); reset(); nav({ search: nextRef.current ?? pickNext(t) }); };
  const goPrev = () => { const prev = trail.current.pop(); if (prev) { reset(); nav({ search: prev }); } };
  const replay = () => { reset(); nav({ search: { band, t, s: newSeed() }, replace: true }); };

  if (!spec) return <main className={cn("puzzle-screen", `tier-${tierFor(band)}`)} />;
  const tpl = TEMPLATES.find((x) => x.id === spec.template);
  if (!tpl) return null;
  const hue = (TEMPLATES.indexOf(tpl) * 47) % 360;
  const celebrating = result?.ok;
  const spatial = spec.template === "sudoku";
  const story = shown?.key === key ? shown.story : spec.story;
  const title = shown?.key === key ? shown.title : spec.title;
  const illustration = <>
    {spatial ? <img className="forest-offline-illustration" src={offlineIllustration} alt="A young explorer, a monkey and a bird discovering treasure tiles in the forest" /> : <PuzzleDrawing template={spec.template} seed={s ?? 1} ornament />}
    {art && <div key={key} className={cn("scene-watercolor", imageReady && loaderDone && "scene-watercolor-reveal")}>
      <img src={art.src} alt="" onLoad={() => setImageReady(true)} className={cn("scene-img", art.final ? "scene-art-final" : "scene-art-preview")} />
    </div>}
  </>;

  const game = (
    <main ref={mainRef} className={cn("puzzle-screen forest-game-scene mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4", spec.template === "sudoku" && "forest-spatial", `tier-${tierFor(band)}`, `age-step-${band}`, celebrating && "is-celebrating", spatial && !celebrating && "is-solving", spatial && storyOpen && "adventure-open")} style={{ ["--scene-hue" as string]: hue }}>
      <div className="play-bg" aria-hidden />
      <WorldBackdrop template={spec.template} />
      <Confetti burst={party} />
      <div className={cn("quest-loader", loaderDone && "quest-loader-done")} role="status" aria-label="Loading next puzzle" aria-hidden={loaderDone}>
        <img className="quest-loader-surface" src={worldFor(spec.template).image} alt="" draggable={false} />
        <div className="quest-loader-content">
          <div className="quest-loader-emblem" aria-hidden="true"><Puzzle strokeWidth={1.5} /></div>
          <p className="quest-loader-text">Your next puzzle</p>
          <p className="quest-loader-detail">A little wonder is on its way.</p>
          <div className="quest-loader-track" aria-hidden="true"><span /></div>
        </div>
      </div>
      {!spatial && <div className={cn("scene-banner", celebrating && "scene-party")} aria-hidden="true">{illustration}</div>}
      {spatial ? <header className="puzzle-header forest-reference-header">
        <div className="forest-header-left">
          <Button asChild variant="game" size="game" className="forest-round-control"><Link to="/" search={{ pick: 1 }} aria-label="Back to age selection"><ArrowLeft /></Link></Button>
          <Button asChild variant="game" size="game" className="forest-age-control"><Link to="/" search={{ pick: 1 }}>{BANDS[band]?.label}<ChevronDown /></Link></Button>
        </div>
        <div className="forest-header-right">
          <details className="forest-settings">
            <Button asChild variant="game" size="game" className="forest-round-control"><summary aria-label="Game settings"><Settings /></summary></Button>
            <div className="forest-settings-menu">
              <Button asChild variant="game"><Link to="/" search={{ pick: 1 }}>Choose age range</Link></Button>
              <WoodenActionButton onClick={replay}>New numbers</WoodenActionButton>
            </div>
          </details>
          <span className="forest-score" aria-label={`${progress.solved} solved, ${progress.streak} streak`}>⭐ {progress.solved} · 🔥 {progress.streak}</span>
        </div>
      </header> : <header className="puzzle-header mb-3 flex items-center justify-between gap-2">
        <Link to="/" search={{ pick: 1 }} className={cn("pill", spec.template === "sudoku" && "forest-round-control")} aria-label={`Choose age range, ${BANDS[band]?.label}`} title="Choose age range">{spec.template === "sudoku" ? <ArrowLeft aria-hidden="true" /> : `← ${BANDS[band]?.label}`}</Link>
        <div className="flex items-center gap-2">
          {spec.template === "sudoku" ? <WoodenActionButton className="forest-round-control" label="New numbers" onClick={replay}><RotateCcw aria-hidden="true" /></WoodenActionButton> : <span className="pill">⭐ {progress.solved} · 🔥 {progress.streak}</span>}
        </div>
      </header>}
      {spatial && <StoryIllustrationFrame title={title}>
        <div className={cn("story-window-art", celebrating && "scene-party")}>{illustration}</div>
      </StoryIllustrationFrame>}
      {spatial && !storyOpen && <button type="button" className="forest-story-hanger" onClick={() => setStoryOpen(true)} aria-label="Read this puzzle’s story"><BookOpen aria-hidden="true" /><span>Story</span></button>}
      {spatial && storyOpen && <section className="forest-adventure" aria-label="Your adventure">
        <p className="adventure-eyebrow">Your adventure</p>
        <div className="adventure-story" tabIndex={0} aria-label="Puzzle story"><p>{story}</p></div>
        <ReadAloud text={story} label="story">Read aloud</ReadAloud>
        <WoodenActionButton className="adventure-begin" onClick={beginPuzzle}>{started ? 'Back to puzzle' : 'Let’s help!'}<ArrowRight aria-hidden="true" /></WoodenActionButton>
      </section>}

      <section className="puzzle-sheet">
        {!spatial && <div className={cn("scene", celebrating && "scene-party")}>
          <div className="scene-text">
            <WoodenTitleSign title={shown?.key === key ? shown.title : spec.title} story={shown?.key === key ? shown.story : spec.story} spatial={spec.template === "sudoku"} />
          </div>
        </div>}
        <div className="puzzle-task"><span>{spec.task}</span>{spatial && <ReadAloud text={spec.task} />}</div>
        <PuzzleStage spatial={spec.template === "sudoku"}>
          <PuzzleBody key={key} spec={spec} report={report} sessionKey={spatial ? key : undefined} />
        </PuzzleStage>
        <div className="puzzle-hint text-center">
          {hint && <p className="forest-hint-plaque">{spec.hint}</p>}
          <WoodenActionButton className={cn(spatial && "forest-reference-hint", hint && "hint-open")} onClick={() => setHint((v) => !v)}>{spatial && <Lightbulb aria-hidden="true" />}{hint ? "Close hint" : "Need a hint?"}</WoodenActionButton>
        </div>
      </section>

      <div className="puzzle-feedback" role="status" aria-live="polite">
        {result && (
          <div key={result.n} className={cn("feedback", spatial ? (result.ok ? "forest-success-ribbon" : "forest-retry-banner") : (result.ok ? "animate-pop bg-success text-success-foreground" : "animate-shake bg-destructive text-destructive-foreground"))}>
            {result.ok ? (spatial ? <VictoryRibbon /> : "Correct! 🎉") : (spatial ? "Not quite. Try again!" : "Incorrect! Try again")}
          </div>
        )}
      </div>

      <div className="world-ledge">
      <nav aria-label="Puzzle navigation" className="puzzle-navigation">
        <WoodenActionButton disabled={!trail.current.length} onClick={goPrev}>{spatial ? <><ArrowLeft aria-hidden="true" /><span>Previous</span></> : "← Previous"}</WoodenActionButton>
        <WoodenActionButton onClick={replay}>{spatial ? <><RotateCcw aria-hidden="true" /><span>New</span></> : "New numbers"}</WoodenActionButton>
        <WoodenActionButton primary={!spatial || !!celebrating} onClick={goNext}>{spatial ? <><span>Next puzzle</span><ArrowRight aria-hidden="true" /></> : "Next puzzle →"}</WoodenActionButton>
      </nav>
      </div>
    </main>
  );
  return spatial ? <ForestViewport intro={storyOpen}>{game}</ForestViewport> : game;
}
