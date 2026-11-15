import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import wood from "@/assets/tree-workshop.jpg";
import { cn } from "@/lib/utils";
import { BANDS, TEMPLATES } from "@/gen/templates";
import { readProgress, tierFor, useProgress } from "@/lib/progress";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({ pick: s.pick ? 1 : undefined }),
  head: () => ({
    meta: [
      { title: "Puzzle Quest — Endless logic puzzles for kids" },
      { name: "description", content: "Fresh logic puzzles every time: codes, robots, mysteries and number magic for ages 3 to 10." },
      { property: "og:title", content: "Puzzle Quest — Endless logic puzzles for kids" },
      { property: "og:description", content: "Fresh logic puzzles every time: codes, robots, mysteries and number magic for ages 3 to 10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Start,
});

const BAND_ICONS = ["🧸", "🐣", "🦄", "🚀", "🦖", "🛸", "🐉"];

function Start() {
  const { pick } = Route.useSearch();
  const nav = useNavigate();
  const [progress, update] = useProgress();

  useEffect(() => {
    const saved = readProgress().band;
    if (saved !== null && !pick) nav({ to: "/play", search: { band: saved }, replace: true });
  }, [pick, nav]);

  const choose = (band: number) => {
    update((p) => ({ ...p, band }));
    nav({ to: "/play", search: { band } });
  };

  return (
    <main className="start-screen">
      <img className="start-surface" src={wood} alt="" aria-hidden draggable={false} />
      <div className="start-floaters" aria-hidden>
        {TEMPLATES.map((t, i) => <span key={t.id} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * -1.3}s`, animationDuration: `${9 + (i % 5) * 2}s` }}>{t.icon}</span>)}
      </div>
      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pt-10 pb-8 text-center">
        <span className="start-badge">✨ A brand-new puzzle every time</span>
        <h1 className="start-title">Puzzle <span>Quest</span></h1>
        <p className="mt-3 max-w-lg text-lg text-muted-foreground sm:text-xl">Crack secret codes, outsmart the robot, solve mysteries and beat the clock. How many can you solve?</p>
        {progress.solved > 0 && <p className="mt-3 font-display text-lg font-semibold">⭐ {progress.solved} solved · 🔥 best streak {progress.best}</p>}
        <h2 className="mt-8 font-display text-2xl font-bold">Pick your level</h2>
        <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {BANDS.map((b) => (
            <button key={b.id} onClick={() => choose(b.id)} className={cn("band-card", `band-${tierFor(b.id)}`, progress.band === b.id && "band-card-current")} style={{ animationDelay: `${b.id * 70}ms` }}>
              <span className="text-4xl">{BAND_ICONS[b.id]}</span>
              <span className="font-display text-xl font-bold">{b.label}</span>
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">{["Tiny thinkers", "Little explorers", "Puzzle pals", "Code crackers", "Brain builders", "Master minds", "Legends"][b.id]}</span>
            </button>
          ))}
        </div>
        <Button asChild variant="game" size="game" className="story-world-entry"><Link to="/story-world" search={{}}><Sparkles />Try Story Worlds<ArrowRight /></Link></Button>
      </section>
    </main>
  );
}
