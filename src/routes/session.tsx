import { createFileRoute } from "@tanstack/react-router";
import { SessionShell } from "@/host/SessionShell";
import { publicGameById } from "@/host/public-games";
import { parseRouteBand } from "@/lib/commons-launch";

type Search = { band: number; mode: "single" | "all"; game?: string | undefined };

export const Route = createFileRoute("/session")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const game = typeof s.game === "string" && publicGameById(s.game) ? s.game : undefined;
    return { band: parseRouteBand(s.band), mode: s.mode === "all" || !game ? "all" : "single", game };
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
  const { band, mode, game } = Route.useSearch();
  return <SessionShell key={`${band}-${mode}-${game ?? ""}`} band={band} mode={mode} gameId={game} />;
}
