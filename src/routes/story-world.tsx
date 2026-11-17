import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Lightbulb, Volume2, RotateCcw, Sparkles, Star } from "lucide-react";
import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";
import { drawTemplate } from "@/gen/deck";
import { newSeed } from "@/gen/rng";
import { PuzzleBody } from "@/gen/Renderer";
import { StoryWorldBackdrop, WorldCelebration } from "@/gen/StoryWorldBackdrop";
import { worldCache, type WorldEntry } from "@/lib/story-world-cache";
import { ART_WAIT_MS, generatorStory, storyWorldKey, storyWorldTier } from "@/lib/story-world";
import { useProgress } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReadAloud } from "@/components/ReadAloud";
import { AudioSettings } from "@/components/AudioSettings";
import { useSceneAudio } from "@/lib/audio/use-scene-audio";

type Search = { band?: number | undefined; t?: string | undefined; s?: number | undefined };
export const Route = createFileRoute("/story-world")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    band: s.band === undefined ? undefined : Math.min(6, Math.max(0, Number(s.band) || 0)),
    t: typeof s.t === "string" ? s.t : undefined,
    s: Number.isFinite(Number(s.s)) && Number(s.s) > 0 ? Number(s.s) : undefined,
  }),
  head: () => ({ meta: [
    { title: "Story Worlds — Ayla’s Puzzles" },
    { name: "description", content: "Step into a magical illustrated adventure with fresh logic puzzles for ages 3–10." },
    { property: "og:title", content: "Story Worlds — Ayla’s Puzzles" },
    { property: "og:description", content: "Magical storybook adventures and age-matched logic puzzles." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: StoryWorld,
});

const animals = ["🐰", "🦊", "🦋", "🐲", "🦜", "🦅", "🐉"];

function StoryWorld() {
  const search = Route.useSearch();
  const nav = useNavigate({ from: "/story-world" });
  const [progress, update] = useProgress();
  const choose = (band: number) => {
    update((p) => ({ ...p, band }));
    nav({ search: { band, t: drawTemplate(band, templatesFor(band).map((t) => t.id)), s: newSeed() } });
  };
  if (search.band === undefined) return <main className="story-world sw-picturebook sw-selection">
    <StoryWorldBackdrop band={0} revealed />
    <header className="sw-topbar"><Button asChild variant="game" size="game" className="sw-button sw-icon"><Link to="/" search={{ pick: 1 }} aria-label="Back to tree games"><ArrowLeft /></Link></Button><span className="sw-brand">Ayla’s Puzzles</span><BookOpen aria-hidden="true" /></header>
    <section className="sw-age-selection">
      <span className="sw-kicker"><Sparkles size={18} /> Story Worlds</span>
      <h1>Ayla’s Puzzles</h1><p className="sw-selection-subtitle">Every puzzle opens a new adventure.</p>
      <h2>Choose your age</h2>
      <div className="sw-age-grid">{BANDS.map((b) => <Button key={b.id} variant="game" size="game" className={cn("sw-age-button", `sw-age-${b.id}`, progress.band === b.id && "sw-age-current")} onClick={() => choose(b.id)}><span aria-hidden="true">{animals[b.id]}</span><strong>{b.label}</strong></Button>)}</div>
      {progress.solved > 0 && <p className="sw-selection-progress"><Star size={18} /> {progress.solved} solved · Best streak {progress.best}</p>}
    </section>
  </main>;
  return <StoryPlay key={search.band} search={{ ...search, band: search.band }} />;
}

function StoryPlay({ search }: { search: Search & { band: number } }) {
  const { band, t, s } = search;
  const nav = useNavigate({ from: "/story-world" });
  const [progress, update] = useProgress();
  const pickNext = useCallback((exclude?: string) => ({ band, t: drawTemplate(band, templatesFor(band).map((x) => x.id), exclude), s: newSeed() }), [band]);
  const valid = !!t && !!s && templatesFor(band).some((x) => x.id === t);
  useEffect(() => { if (!valid) nav({ search: pickNext(), replace: true }); }, [valid, nav, pickNext]);
  const spec = useMemo(() => valid && t && s ? generate(t, band, s) : null, [valid, t, s, band]);
  const key = storyWorldKey(band, t ?? "", s ?? 0);
  return spec ? <StoryRound key={key} spec={spec} search={{ band, t, s }} puzzleKey={key} pickNext={pickNext} progress={progress} update={update} /> : <main className={`story-world sw-${storyWorldTier(band)}`}><StoryWorldBackdrop band={band} revealed /></main>;
}

type RoundProps = {
  spec: ReturnType<typeof generate>;
  search: Search & { band: number };
  puzzleKey: string;
  pickNext: (exclude?: string) => Search & { band: number };
  progress: ReturnType<typeof useProgress>[0];
  update: ReturnType<typeof useProgress>[1];
};

// Trail is per alternative session; URL seeds still reproduce every visited puzzle.
const trail: (Search & { band: number })[] = [];
function StoryRound({ spec, search, puzzleKey, pickNext, progress, update }: RoundProps) {
  const nav = useNavigate({ from: "/story-world" });
  const { band, s } = search;
  const [entry, setEntry] = useState<WorldEntry>();
  const [, refresh] = useState(0);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const [burst, setBurst] = useState(0);
  const [checkTarget, setCheckTarget] = useState<HTMLDivElement | null>(null);
  const next = useRef<Search & { band: number }>(search);
  const credited = useRef(false);
  const audio = useSceneAudio(spec.template, puzzleKey);

  useEffect(() => {
    const offline = !navigator.onLine;
    const e = worldCache.ensure(puzzleKey, spec, band, offline);
    setEntry(e);
    let artTimer: ReturnType<typeof setTimeout> | undefined;
    let minimumTimer: ReturnType<typeof setTimeout> | undefined;
    let observingStory = false;
    const changed = () => {
      refresh((n) => n + 1);
      if (!e.frozen) return;
      if (!observingStory) {
        observingStory = true;
        // Timeout dismisses only the loader: the live painting is not cancelled.
        artTimer = setTimeout(() => setReady(true), ART_WAIT_MS);
        const picked = pickNext(spec.template);
        next.current = picked;
        if (picked.t && picked.s) worldCache.ensure(storyWorldKey(band, picked.t, picked.s), generate(picked.t, band, picked.s), band, offline, puzzleKey);
      }
      if (e.settled || offline) {
        clearTimeout(artTimer);
        minimumTimer = setTimeout(() => setReady(true), offline ? 0 : 500);
      }
    };
    e.listeners.add(changed); changed();
    return () => { e.listeners.delete(changed); clearTimeout(artTimer); clearTimeout(minimumTimer); };
  }, [puzzleKey, spec, band, pickNext]);

  const report = useCallback((ok: boolean) => {
    if (credited.current) return;
    audio.effect(ok ? "success" : "retry");
    setResult(ok);
    if (ok) {
      credited.current = true; setBurst((n) => n + 1);
      update((p) => { const streak = p.streak + 1; return { ...p, solved: p.solved + 1, streak, best: Math.max(p.best, streak) }; });
    } else update((p) => ({ ...p, streak: 0 }));
  }, [update, audio]);
  const goNext = () => { trail.push(search); nav({ search: next.current }); };
  const goPrevious = () => { const previous = trail.pop(); if (previous) nav({ search: previous }); };
  const replay = () => nav({ search: { ...search, s: newSeed() }, replace: true });
  const story = entry?.frozen ?? generatorStory(spec);
  const tpl = TEMPLATES.find((x) => x.id === spec.template);

  return <main onClickCapture={audio.onClickCapture} className={cn("story-world", `sw-${storyWorldTier(band)}`, result === true && "sw-celebrating")} data-template={spec.template}>
    <StoryWorldBackdrop key={puzzleKey} band={band} template={spec.template} seed={s} entry={entry} revealed={ready} />
    <WorldCelebration burst={burst} />
    <header className="sw-topbar">
      <Button asChild variant="game" size="game" className="sw-button sw-icon"><Link to="/story-world" search={{}} aria-label="Choose age"><ArrowLeft /></Link></Button>
      <Button asChild variant="game" size="game" className="sw-button sw-age-control"><Link to="/story-world" search={{}}>{BANDS[band]?.label}<ChevronDown /></Link></Button>
      <span className="sw-brand">Ayla’s Puzzles</span>
      <details className="audio-menu sw-audio-menu"><summary className="sw-button sw-icon" aria-label="Sound settings" data-audio-ignore><Volume2 /></summary><AudioSettings /></details>
      <span className="sw-score" aria-label={`${progress.solved} solved, ${progress.streak} streak`}><Star size={16} /> {progress.solved}<span> · 🔥 {progress.streak}</span></span>
    </header>
    <div className="sw-composition">
      <section className="sw-story" aria-label="Puzzle story">
        <span className="sw-kicker"><BookOpen size={16} /> {tpl?.icon} Story Worlds</span>
        <h1>{story.title}</h1>
        <p>{story.story}</p>
        <ReadAloud group={puzzleKey} content={{ title: story.title, story: story.story, task: spec.task }} className="sw-read-aloud">Read story</ReadAloud>
        {entry?.error && <details className="sw-art-notice"><summary>Illustration update unavailable</summary><p>{entry.error}</p></details>}
      </section>
      <section className="sw-game-area" aria-label="Puzzle">
        <div className="sw-task-row"><h2 className="sw-task">{spec.task}</h2><ReadAloud group={puzzleKey} content={{ title: story.title, story: story.story, task: spec.task }} className="sw-read-aloud" /></div>
        <div className="sw-game-scroll" tabIndex={0} aria-label="Puzzle pieces">
          <PuzzleBody spec={spec} report={report} storyWorld checkTarget={checkTarget} completed={result === true} />
        </div>
      </section>
    </div>
    <footer className="sw-footer">
      <div className="sw-hint-row"><Button variant="game" size="game" className="sw-button sw-hint-button" onClick={() => setHint((v) => !v)} aria-expanded={hint}><Lightbulb />{hint ? "Close hint" : "Need a hint?"}</Button>{hint && <p className="sw-hint">{spec.hint}</p>}</div>
      <div className={cn("sw-feedback", result === false && "sw-incorrect", result === true && "sw-correct")} role="status" aria-live="polite">{result === true ? "Wonderful! You solved it! ✨" : result === false ? "Not quite. Try again!" : ""}</div>
      <div className="sw-primary-action" ref={setCheckTarget}>{result === true && <Button variant="game" size="game" className="sw-button sw-primary" onClick={goNext}>Next adventure <ArrowRight /></Button>}</div>
      <nav className="sw-navigation" aria-label="Puzzle navigation">
        <Button variant="game" size="game" className="sw-button" onClick={goPrevious} disabled={!trail.length}><ArrowLeft /><span>Previous</span></Button>
        <Button variant="game" size="game" className="sw-button" onClick={replay}><RotateCcw /><span>New</span></Button>
        <Button variant="game" size="game" className="sw-button" onClick={goNext}><span>Next puzzle</span><ArrowRight /></Button>
      </nav>
    </footer>
    {!ready && <div className="sw-loader" role="status"><div className="sw-loader-copy"><span className="sw-loader-icon">{tpl?.icon ?? "✨"}</span><h2>{entry?.frozen ? story.title : "A new adventure…"}</h2><p>{entry?.frozen ? story.story : "Turning the page to your next story."}</p><span className="sw-loader-line" /></div></div>}
  </main>;
}