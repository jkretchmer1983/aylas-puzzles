import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";
import { newSeed } from "@/gen/rng";
import { PuzzleBody } from "@/gen/Renderer";
import { tierFor, useProgress } from "@/lib/progress";
import { writeStory } from "@/lib/story.functions";
import { streamImage } from "@/lib/stream-image";

type Search = { band: number; t?: string; s?: number };

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

function PuzzleStage({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    const fit = () => {
      if (!window.matchMedia("(max-width: 639px)").matches) return setScale(1);
      setScale(Math.min(1, outer.clientHeight / Math.max(1, inner.offsetHeight), outer.clientWidth / Math.max(1, inner.scrollWidth)));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(outer); ro.observe(inner);
    window.addEventListener("resize", fit);
    fit();
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  return <div ref={frame} className="puzzle-stage"><div ref={content} className="puzzle-stage-content" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}

type Story = { title: string; story: string; image?: string; final?: boolean };

function Confetti({ burst }: { burst: number }) {
  const [bits, setBits] = useState<{ x: number; d: number; c: string; r: number }[]>([]);
  useEffect(() => {
    if (!burst) return;
    const cs = ["var(--sun)", "var(--berry)", "var(--sky)", "var(--leaf)", "var(--primary)"];
    setBits(Array.from({ length: 60 }, () => ({ x: Math.random() * 100, d: Math.random() * 0.6, c: cs[Math.floor(Math.random() * cs.length)]!, r: Math.random() * 720 - 360 })));
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
  const [online, setOnline] = useState(false);
  const [stories, setStories] = useState<Record<string, Story>>({});
  const trail = useRef<Search[]>([]);
  const started = useRef(new Set<string>());
  const writeStoryFn = useServerFn(writeStory);

  const pickNext = useCallback((exclude?: string) => {
    const pool = templatesFor(band).filter((x) => x.id !== exclude);
    return { band, t: pool[Math.floor(Math.random() * pool.length)]!.id, s: newSeed() };
  }, [band]);

  // Fill in a puzzle when the address has none.
  useEffect(() => {
    if (!t || !s || !templatesFor(band).some((x) => x.id === t)) nav({ search: pickNext(), replace: true });
  }, [t, s, band, nav, pickNext]);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on); window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);

  const ready = !!t && !!s;
  const spec = ready ? generate(t!, band, s!) : null;
  const key = `${band}-${t}-${s}`;

  // Online: AI story + custom picture. Offline: built-in scene.
  useEffect(() => {
    if (!spec || !online || started.current.has(key)) return;
    started.current.add(key);
    (async () => {
      const r = await writeStoryFn({ data: { age: BANDS[band]!.min, theme: spec.theme, title: spec.title, story: spec.story, task: spec.task } }).catch(() => null);
      if (!r || !r.ok) return;
      setStories((m) => ({ ...m, [key]: { title: r.title, story: r.story } }));
      await streamImage("/api/generate-image", { prompt: r.imagePrompt }, (image, final) => setStories((m) => ({ ...m, [key]: { ...m[key]!, image, final } }))).catch((e) => console.warn("image failed", e));
    })();
  }, [key, online, spec, band, writeStoryFn]);

  const report = useCallback((ok: boolean) => {
    setResult((r) => ({ ok, n: (r?.n ?? 0) + 1 }));
    if (ok) {
      setParty((p) => p + 1);
      update((p) => { const streak = p.streak + 1; return { ...p, solved: p.solved + 1, streak, best: Math.max(p.best, streak) }; });
    } else update((p) => ({ ...p, streak: 0 }));
  }, [update]);

  const reset = () => { setResult(null); setHint(false); };
  const goNext = () => { trail.current.push({ band, t, s }); reset(); nav({ search: pickNext(t) }); };
  const goPrev = () => { const prev = trail.current.pop(); if (prev) { reset(); nav({ search: prev }); } };
  const replay = () => { reset(); nav({ search: { band, t, s: newSeed() }, replace: true }); };

  if (!spec) return <main className={cn("puzzle-screen", `tier-${tierFor(band)}`)} />;
  const story = stories[key];
  const tpl = TEMPLATES.find((x) => x.id === spec.template)!;
  const hue = (TEMPLATES.indexOf(tpl) * 47) % 360;
  const celebrating = result?.ok;

  return (
    <main className={cn("puzzle-screen mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4", `tier-${tierFor(band)}`, celebrating && "is-celebrating")} style={{ ["--scene-hue" as string]: hue }}>
      <div className="play-bg" aria-hidden />
      <Confetti burst={party} />
      <header className="puzzle-header mb-3 flex items-center justify-between gap-2">
        <Link to="/" search={{ pick: 1 }} className="pill">← {BANDS[band]!.label}</Link>
        <div className="flex items-center gap-2">
          <span className="pill" title={online ? "AI stories on" : "Offline puzzles"}>{online ? "✨ AI" : "📴 Offline"}</span>
          <span className="pill">⭐ {progress.solved} · 🔥 {progress.streak}</span>
        </div>
      </header>

      <section className="puzzle-sheet">
        <div className={cn("scene", celebrating && "scene-party")}>
          {story?.image && <img src={story.image} alt="" className={cn("scene-img", !story.final && "blur-xl")} />}
          <div className="scene-floaters" aria-hidden>{spec.scene.map((e, i) => <span key={i} style={{ left: `${10 + ((i * 29) % 80)}%`, animationDelay: `${i * -0.7}s` }}>{e}</span>)}</div>
          <div className="scene-text">
            <span className="scene-tag">{tpl.icon} {tpl.name}</span>
            <h1 className="scene-title">{story?.title ?? spec.title}</h1>
            <p className="puzzle-prompt">{story?.story ?? spec.story}</p>
          </div>
        </div>
        <p className="puzzle-task">{spec.task}</p>
        <PuzzleStage>
          <PuzzleBody key={key} spec={spec} report={report} />
        </PuzzleStage>
        <div className="puzzle-hint text-center">
          {hint ? <p className="rounded-2xl bg-secondary p-3 text-lg">💡 {spec.hint}</p> : <button className="text-base font-bold text-primary underline" onClick={() => setHint(true)}>Need a hint?</button>}
        </div>
      </section>

      <div className="puzzle-feedback" role="status" aria-live="polite">
        {result && (
          <div key={result.n} className={cn("feedback", result.ok ? "animate-pop bg-success text-success-foreground" : "animate-shake bg-destructive text-destructive-foreground")}>
            {result.ok ? "Correct! 🎉" : "Incorrect! Try again"}
          </div>
        )}
      </div>

      <nav aria-label="Puzzle navigation" className="puzzle-navigation">
        <button className="nav-btn nav-soft" disabled={!trail.current.length} onClick={goPrev}>← Previous</button>
        <button className="nav-btn nav-soft" onClick={replay}>🔁 New numbers</button>
        <button className={cn("nav-btn nav-main", celebrating && "nav-glow")} onClick={goNext}>Next puzzle →</button>
      </nav>
    </main>
  );
}
