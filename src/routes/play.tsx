import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BANDS, TEMPLATES, generate, templatesFor } from "@/gen/templates";
import { newSeed } from "@/gen/rng";
import { PuzzleBody } from "@/gen/Renderer";
import { tierFor, useProgress } from "@/lib/progress";
import { PuzzleDrawing } from "@/gen/PuzzleDrawing";
import { imagePrompt } from "@/gen/drawing";
import { ensureArt, subscribeArt } from "@/lib/art-cache";
import { ensureStory, subscribeStory } from "@/lib/story-cache";
import { DRAWING_THEMES } from "@/gen/drawing";

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

  const pickNext = useCallback((exclude?: string) => {
    const pool = templatesFor(band).filter((x) => x.id !== exclude);
    return { band, t: pool[Math.floor(Math.random() * pool.length)]?.id, s: newSeed() };
  }, [band]);

  // Fill in a puzzle when the address has none.
  useEffect(() => {
    if (!t || !s || !templatesFor(band).some((x) => x.id === t)) nav({ search: pickNext(), replace: true });
  }, [t, s, band, nav, pickNext]);

  const spec = t && s ? generate(t, band, s) : null;
  const key = `${band}-${t}-${s}`;
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
    if (ok) {
      setParty((p) => p + 1);
      update((p) => { const streak = p.streak + 1; return { ...p, solved: p.solved + 1, streak, best: Math.max(p.best, streak) }; });
    } else update((p) => ({ ...p, streak: 0 }));
  }, [update]);

  const reset = () => { setResult(null); setHint(false); };
  const goNext = () => { trail.current.push({ band, t, s }); reset(); nav({ search: nextRef.current ?? pickNext(t) }); };
  const goPrev = () => { const prev = trail.current.pop(); if (prev) { reset(); nav({ search: prev }); } };
  const replay = () => { reset(); nav({ search: { band, t, s: newSeed() }, replace: true }); };

  if (!spec) return <main className={cn("puzzle-screen", `tier-${tierFor(band)}`)} />;
  const tpl = TEMPLATES.find((x) => x.id === spec.template);
  if (!tpl) return null;
  const hue = (TEMPLATES.indexOf(tpl) * 47) % 360;
  const celebrating = result?.ok;

  return (
    <main className={cn("puzzle-screen mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4", `tier-${tierFor(band)}`, celebrating && "is-celebrating")} style={{ ["--scene-hue" as string]: hue }}>
      <div className="play-bg" aria-hidden />
      <Confetti burst={party} />
      <div className={cn("quest-loader", loaderDone && "quest-loader-done")} role="status" aria-label="Loading next puzzle" aria-hidden={loaderDone}>
        <div className="quest-loader-orbit" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ ["--i" as string]: i }} />)}</div>
        <span className="quest-loader-icon" aria-hidden>{tpl.icon}</span>
        <p className="quest-loader-text">Painting your {tpl.name} puzzle…</p>
      </div>
      <header className="puzzle-header mb-3 flex items-center justify-between gap-2">
        <Link to="/" search={{ pick: 1 }} className="pill">← {BANDS[band]?.label}</Link>
        <div className="flex items-center gap-2">
          <span className="pill">⭐ {progress.solved} · 🔥 {progress.streak}</span>
        </div>
      </header>

      <section className="puzzle-sheet">
        <div className={cn("scene", celebrating && "scene-party")}>
          <PuzzleDrawing template={spec.template} seed={s ?? 1} />
          {art && <div key={key} className={cn("scene-watercolor", imageReady && loaderDone && "scene-watercolor-reveal")}>
            <img src={art.src} alt="" onLoad={() => setImageReady(true)} className={cn("scene-img", art.final ? "scene-art-final" : "scene-art-preview")} />
          </div>}
          <div className="scene-text">
            <span className="scene-tag">{tpl.icon} {tpl.name}</span>
            <h1 className="scene-title">{shown?.key === key ? shown.title : spec.title}</h1>
            <p className="puzzle-prompt">{shown?.key === key ? shown.story : spec.story}</p>
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
