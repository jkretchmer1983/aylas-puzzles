import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { newSeed } from "@/gen/rng";
import { RobotGame, type RobotSearch } from "@/robot/RobotGame";
import "@/robot/robot.css";

export const Route = createFileRoute("/robot")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): RobotSearch => ({
    band: Math.max(4, Math.min(6, Number(search.band) || 4)),
    s: search.s ? Number(search.s) : undefined,
    b: search.b ? Number(search.b) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "The Robot Took a Shortcut — Ayla’s Puzzles" },
      { name: "description", content: "Program a cream-and-orange postal robot through a sunny canyon depot in this isolated puzzle review." },
      { property: "og:title", content: "The Robot Took a Shortcut — Ayla’s Puzzles" },
      { property: "og:description", content: "Build a route, deliver every parcel, and review the new interactive robot puzzle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RobotReviewRoute,
});

function RobotReviewRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/robot" });
  useEffect(() => {
    if (!search.s) navigate({ search: { band: search.band, s: newSeed() }, replace: true });
  }, [search.s, search.band, navigate]);
  if (!search.s) return <main className="robot-game robot-route-loading"><div className="robot-loader" role="status"><span aria-hidden="true">🤖</span><p>Warming up Pip’s wheels…</p></div></main>;
  const boardSeed = search.b ?? search.s;
  return <RobotGame
    key={`${search.band}:${search.s}:${boardSeed}`}
    band={search.band}
    instanceSeed={search.s}
    boardSeed={boardSeed}
    navigate={(next, replace = false) => navigate({ search: next, replace })}
  />;
}
