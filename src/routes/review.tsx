import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SessionShell } from "@/host/SessionShell";
import { publicGameById, PUBLIC_GAMES } from "@/host/public-games";
import { sessionTargets } from "@/host/eligibility";
import { REVIEW_CHILD_ORIGINS, reviewHarnessAllowed, reviewTargets } from "@/host/review-origins";
import { refreshCatalog, useCatalog, useManifestStatus, useRegistry } from "@/lib/catalog-store";
import { parseRouteBand } from "@/lib/commons-launch";
import { PUBLIC_BANDS, bandById } from "@/lib/public-catalog";

type Search = { band: number; mode?: "single" | "all" | undefined; game?: string | undefined };

/** Opt-in PRIVATE review harness: real hub session against each child's private review preview. */
export const Route = createFileRoute("/review")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const game = typeof s.game === "string" && publicGameById(s.game) ? s.game : undefined;
    const mode = s.mode === "all" ? "all" : s.mode === "single" && game ? "single" : undefined;
    return { band: parseRouteBand(s.band), mode, game: mode === "single" ? game : undefined };
  },
  head: () => ({
    meta: [
      { title: "Private review — Ayla’s Puzzles" },
      { name: "description", content: "Private review of the shared game controls across Ayla’s Puzzles preview games." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Private review — Ayla’s Puzzles" },
      { property: "og:description", content: "Private review of the shared game controls across Ayla’s Puzzles preview games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewRoute,
});

function ReviewRoute() {
  const { band, mode, game } = Route.useSearch();
  const allowed = typeof window !== "undefined" && reviewHarnessAllowed(window.location.origin);
  if (!allowed) return <main className="min-h-dvh bg-background p-6 text-foreground">
    <h1 className="text-xl font-semibold">Private review only</h1>
    <p className="mt-2 max-w-prose">This review page works only on a private preview of the hub. Nothing is launched here.</p>
    <Link to="/" search={{ band }} className="mt-4 inline-flex min-h-12 items-center font-semibold underline">All games</Link>
  </main>;
  if (mode) return <SessionShell key={`review-${band}-${mode}-${game ?? ""}`} review band={band} mode={mode} gameId={game} />;
  return <ReviewPicker band={band} />;
}

function ReviewPicker({ band }: { band: number }) {
  const catalog = useCatalog();
  const registry = useRegistry();
  const status = useManifestStatus();
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); void refreshCatalog(true); }, []);
  const eligible = useMemo(() => origin ? reviewTargets(sessionTargets(catalog, registry, band, origin), origin) ?? [] : [], [catalog, registry, band, origin]);
  const range = bandById(band);
  const ready = new Set(eligible.map((t) => t.gameId));
  return <main className="min-h-dvh bg-background p-4 text-foreground sm:p-8">
    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Private review harness · not the live menu</p>
    <h1 className="mt-1 text-2xl font-bold">Shared controls review</h1>
    <p className="mt-2 max-w-prose">Opens each game’s private review preview inside the real hub session. Check: top Next opens a different game, Previous brings back the earlier game with its work, the centre New keeps the same game, and levels stay at 1–2.</p>
    <nav aria-label="Age" className="mt-4 flex flex-wrap gap-2">
      {PUBLIC_BANDS.map((b) => <Link key={b.id} to="/review" search={{ band: b.id }} aria-current={b.id === band ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-full border border-input px-4 font-semibold ${b.id === band ? "bg-primary text-primary-foreground" : "bg-background"}`}>{b.label}</Link>)}
    </nav>
    <p className="mt-4" role="status">{status === "pending" ? "Checking the live game list…" : status === "failed" ? "Couldn’t load the live game list; showing the last saved one." : `${eligible.length} games ready for ages ${range.min}–${range.max}.`}</p>
    <div className="mt-3">
      <Link to="/review" search={{ band, mode: "all" }} disabled={!eligible.length}
        className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground aria-disabled:opacity-50">Play all</Link>
    </div>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {PUBLIC_GAMES.map((g) => <li key={g.gameId} className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
        <span><span className="block font-semibold">{g.title}</span><span className="block break-all text-xs text-muted-foreground">{REVIEW_CHILD_ORIGINS[g.gameId]}</span></span>
        {ready.has(g.gameId)
          ? <Link to="/review" search={{ band, mode: "single", game: g.gameId }} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-input px-4 font-semibold">Open</Link>
          : <span className="shrink-0 text-sm text-muted-foreground">Not for this age</span>}
      </li>)}
    </ul>
  </main>;
}
