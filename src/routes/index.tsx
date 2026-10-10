import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { puzzles } from "@/puzzles";
import { Btn } from "@/puzzles/kit";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({ p: Math.min(40, Math.max(1, Number(s.p) || 1)) }),
  head: () => ({
    meta: [
      { title: "Logic Puzzles — Solve all 40!" },
      { name: "description", content: "Forty hands-on logic puzzles for kids, made for iPad." },
      { property: "og:title", content: "Logic Puzzles — Solve all 40!" },
      { property: "og:description", content: "Forty hands-on logic puzzles for kids, made for iPad." },
    ],
  }),
  component: Index,
});

function Index() {
  const { p } = Route.useSearch();
  const nav = useNavigate({ from: "/" });
  const [result, setResult] = useState<{ ok: boolean; n: number } | null>(null);
  const [hint, setHint] = useState(false);
  const pz = puzzles[p - 1];
  const go = (n: number) => { setResult(null); setHint(false); nav({ search: { p: n } }); };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6">
      <header className="mb-4 flex items-center justify-between">
        <span className="font-display text-xl font-bold text-primary">LOGIC PUZZLE {p} <span className="text-muted-foreground">/ 40</span></span>
        <span className="rounded-full bg-accent px-4 py-1 font-display font-semibold text-accent-foreground">Age {pz.age}</span>
      </header>

      <section className="rounded-3xl border-4 border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-4xl font-bold">{pz.title}</h1>
        <p className="mt-3 text-xl">{pz.prompt}</p>
        <p className="mt-2 font-display text-2xl font-semibold text-primary">{pz.task}</p>
        <div className="mt-8">
          <pz.C key={p} report={(ok) => setResult((r) => ({ ok, n: (r?.n ?? 0) + 1 }))} />
        </div>
        <div className="mt-6 text-center">
          {hint ? <p className="rounded-2xl bg-secondary p-3 text-lg">💡 {pz.hint}</p> : <button onClick={() => setHint(true)} className="font-display text-lg text-primary underline">Need a hint?</button>}
        </div>
      </section>

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

      <nav className="mt-auto flex items-center justify-between gap-4 pt-8">
        <Btn variant="soft" disabled={p === 1} onClick={() => go(p - 1)}>← Previous puzzle</Btn>
        <Btn disabled={p === 40} onClick={() => go(p + 1)}>Next puzzle →</Btn>
      </nav>
    </main>
  );
}
