import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PuzzleSpec } from "./types";

/** Read only visible clues. These props never inspect or derive the generator's answer. */
export function SceneClues({ spec }: { spec: PuzzleSpec }) {
  const [served, setServed] = useState(0);
  if (spec.template === "sequence") {
    const trail = spec.task.split(", …")[0]?.split(", ") ?? [];
    return <div className="river-trail" aria-label="Numbered stepping stones">{trail.map((n, i) => <span className="trail-stone" key={i}>{n}</span>)}<span className="trail-stone trail-gap">?</span></div>;
  }
  if (spec.template === "fraction") {
    const match = spec.task.match(/^(\d+)\/(\d+)/);
    if (!match) return null;
    const numerator = Number(match[1]), denominator = Number(match[2]);
    return <div className="pie-board"><div className="fraction-pie" aria-label={`${numerator} of ${denominator} equal slices`}><svg viewBox="0 0 160 160" aria-hidden="true">{Array.from({ length: denominator }, (_, i) => {
      const a = i * Math.PI * 2 / denominator - Math.PI / 2, b = (i + 1) * Math.PI * 2 / denominator - Math.PI / 2;
      return <path key={i} className={i < numerator ? "pie-berry" : "pie-crust"} d={`M80 80 L${80 + 70 * Math.cos(a)} ${80 + 70 * Math.sin(a)} A70 70 0 ${b - a > Math.PI ? 1 : 0} 1 ${80 + 70 * Math.cos(b)} ${80 + 70 * Math.sin(b)} Z`} />;
    })}</svg></div></div>;
  }
  if (spec.template === "share") {
    const match = spec.task.match(/^(\d+) (.+) shared equally between (\d+) friends/);
    if (!match) return null;
    const total = Number(match[1]), friends = Number(match[3]);
    return <div className="sharing-table"><Button variant="game" size="game" className="serving-basket" disabled={served >= total} onClick={() => setServed((n) => n + 1)} aria-label="Serve one treat to the next friend"><span>{match[2]}</span><strong>{total - served}</strong></Button><div className="sharing-plates">{Array.from({ length: friends }, (_, i) => <Button variant="game" size="game" key={i} className="serving-plate" onClick={() => setServed(0)} aria-label={`Friend ${i + 1}, ${Math.floor(served / friends) + (i < served % friends ? 1 : 0)} treats; reset serving`}><small>{spec.scene[i] ?? i + 1}</small><span key={served}>{Math.floor(served / friends) + (i < served % friends ? 1 : 0)}</span></Button>)}</div></div>;
  }
  return null;
}

export function BalanceClues({ lines }: { lines: string[] }) {
  const [weighed, setWeighed] = useState<string | null>(null);
  return <div className="balance-clues">{lines.map((line, i) => {
    const [left, right] = line.split(" = ");
    return <div className="market-scale" key={i} aria-label={line}><div className="scale-beam" aria-hidden="true" />{[left, right].map((value, side) => <Button variant="game" size="game" key={`${i}-${side}`} aria-label={`Weigh ${value}`} className={weighed === `${i}-${side}` ? "scale-pan pan-weighed" : "scale-pan"} onClick={() => setWeighed(`${i}-${side}`)}>{value}</Button>)}<span className="scale-post" aria-hidden="true" /></div>;
  })}</div>;
}