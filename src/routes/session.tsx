import { createFileRoute } from "@tanstack/react-router";
import { SessionShell } from "@/host/SessionShell";
import { publicGameById } from "@/host/public-games";
import { parseRouteBand } from "@/lib/commons-launch";

type Search = { band: number; mode: "single" | "all"; game?: string | undefined; step?: "next" | "previous" | undefined };

export const Route = createFileRoute("/session")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const game = typeof s.game === "string" && publicGameById(s.game) ? s.game : undefined;
    // step: a standalone host's top arrow (only with mode=all and a known public gameId).
    const step = game && s.mode === "all" && (s.step === "next" || s.step === "previous") ? s.step : undefined;
    return { band: parseRouteBand(s.band), mode: s.mode === "all" || !game ? "all" : "single", game, step };
  },
  head: () => ({
    meta: [
      { title: "Playing — Ayla’s Puzzles" },
      { name: "description", content: "Your Ayla’s Puzzles adventure, with the next puzzle ready to go." },
      { property: "og:title", content: "Playing — Ayla’s Puzzles" },
      { property: "og:description", content: "Your Ayla’s Puzzles adventure, with the next puzzle ready to go." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionRoute,
});

function SessionRoute() {
  const { band, mode, game, step } = Route.useSearch();
  // All-mode sessions key by band only, so cleaning a consumed step from the address bar never remounts.
  return <SessionShell key={mode === "all" ? `${band}-all` : `${band}-single-${game ?? ""}`} band={band} mode={mode} gameId={mode === "single" ? game : undefined} step={step && game ? { gameId: game, step } : undefined} />;
}
