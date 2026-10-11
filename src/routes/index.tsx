import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { puzzles } from "@/puzzles";
import { Btn } from "@/puzzles/kit";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({ p: Math.min(puzzles.length, Math.max(1, Number(s.p) || 1)) }),
  head: () => ({
    meta: [
      { title: "Logic Puzzles — Solve them all!" },
      { name: "description", content: "Seventy hands-on logic puzzles for kids, made for iPad." },
      { property: "og:title", content: "Logic Puzzles — Solve them all!" },
      { property: "og:description", content: "Seventy hands-on logic puzzles for kids, made for iPad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function PuzzleStage({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const outer = frame.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const fit = () => {
      if (!window.matchMedia("(max-width: 639px)").matches) {
        setScale(1);
        return;
      }
      setScale(Math.min(1, outer.clientHeight / Math.max(1, inner.offsetHeight), outer.clientWidth / Math.max(1, inner.scrollWidth)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    window.addEventListener("resize", fit);
    document.fonts.ready.then(fit);
    fit();
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);

  return <div ref={frame} className="puzzle-stage"><div ref={content} className="puzzle-stage-content" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}

function Index() {
  const { p } = Route.useSearch();
  const nav = useNavigate({ from: "/" });
  const [result, setResult] = useState<{ ok: boolean; n: number } | null>(null);
  const [hint, setHint] = useState(false);
  const pz = puzzles[p - 1];
  const go = (n: number) => { setResult(null); setHint(false); nav({ search: { p: n } }); };

  return (
    <main className="puzzle-screen mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6">
      <header className="puzzle-header mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="min-w-0 truncate font-display text-xl font-bold text-primary">LOGIC PUZZLE {p} <span className="text-muted-foreground">/ {puzzles.length}</span></span>
        <span className="shrink-0 rounded-full bg-accent px-4 py-1 font-display font-semibold text-accent-foreground">Age {pz.age}</span>
      </header>

      <section className="puzzle-sheet rounded-3xl border-4 border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-4xl font-bold">{pz.title}</h1>
        <p className="puzzle-prompt mt-3 text-xl">{pz.prompt}</p>
        <p className="puzzle-task mt-2 font-display text-2xl font-semibold text-primary">{pz.task}</p>
        <PuzzleStage>
          <pz.C key={p} report={(ok) => setResult((r) => ({ ok, n: (r?.n ?? 0) + 1 }))} />
        </PuzzleStage>
        <div className="puzzle-hint mt-6 text-center">
          {hint ? <p className="rounded-2xl bg-secondary p-3 text-lg">💡 {pz.hint}</p> : <Btn variant="ghost" className="border-0 bg-transparent px-2 py-2 text-base text-primary underline" onClick={() => setHint(true)}>Need a hint?</Btn>}
        </div>
      </section>

      <div className="puzzle-feedback" role="status" aria-live="polite">
      {result && (
        <div
          key={result.n}
          className={cn(
            "mx-auto mt-6 rounded-3xl px-10 py-4 font-display text-5xl font-bold",
            result.ok ? "animate-pop bg-success text-success-foreground" : "animate-shake bg-destructive text-destructive-foreground",
          )}
        >
          {result.ok ? "Correct! 🎉" : "Incorrect! Try again"}
        </div>
      )}
      </div>

      <nav aria-label="Puzzle navigation" className="puzzle-navigation mt-auto flex items-center justify-between gap-4 pt-8">
        <Btn variant="soft" disabled={p === 1} onClick={() => go(p - 1)}>← Previous puzzle</Btn>
        <Btn disabled={p === puzzles.length} onClick={() => go(p + 1)}>Next puzzle →</Btn>
      </nav>
    </main>
  );
}
