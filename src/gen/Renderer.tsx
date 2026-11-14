import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Kind, PuzzleSpec, ShapeName, Visual } from "./types";
import { Button } from "@/components/ui/button";
import { CarvedMark, PuzzleWorld } from "./PuzzleWorld";
import { BalanceClues, SceneClues } from "./SceneMechanics";
import { EngravedNumber } from "./ForestObjects";

type Report = (ok: boolean) => void;

function Key({ children, onClick, className, disabled }: { children: React.ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <Button variant="game" size="game" disabled={disabled} onClick={onClick} className={cn("pz-key", className)}>
      {children}
    </Button>
  );
}

function CheckButton({ onClick, disabled, ready = false }: { onClick: () => void; disabled?: boolean; ready?: boolean }) {
  return (
    <div className={cn("mt-4 flex justify-center pz-check-wrap", ready && "pz-check-ready")}>
      <Button variant="game" size="game" disabled={disabled} onClick={onClick} className="pz-check">Check my answer ✓</Button>
    </div>
  );
}

/* ---------- visuals ---------- */
function ShapeSvg({ kind }: { kind: ShapeName }) {
  const poly = (n: number) => Array.from({ length: n }, (_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${50 + 40 * Math.cos(a)},${50 + 40 * Math.sin(a)}`; }).join(" ");
  const fill = { circle: "fill-sky", triangle: "fill-leaf", square: "fill-berry", pentagon: "fill-sun", hexagon: "fill-primary", star: "fill-sun" }[kind];
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 overflow-visible">
      {kind === "circle" ? <circle cx="50" cy="50" r="40" className={cn(fill, "stroke-ink")} strokeWidth="5" /> : kind === "square" ? <rect x="12" y="12" width="76" height="76" rx="4" className={cn(fill, "stroke-ink")} strokeWidth="5" /> : <polygon points={poly({ triangle: 3, pentagon: 5, hexagon: 6, star: 5 }[kind])} className={cn(fill, "stroke-ink")} strokeWidth="5" strokeLinejoin="round" />}
    </svg>
  );
}

function Clock({ h, m }: { h: number; m: number }) {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-40 w-40">
      <circle cx="100" cy="100" r="92" className="fill-card stroke-ink" strokeWidth="8" />
      {Array.from({ length: 12 }, (_, i) => { const a = (i + 1) * 30 * (Math.PI / 180); return <text key={i} x={100 + 72 * Math.sin(a)} y={100 - 72 * Math.cos(a) + 8} textAnchor="middle" className="fill-foreground font-display" fontSize="22" fontWeight="700">{i + 1}</text>; })}
      <line x1="100" y1="100" x2={100 + 45 * Math.sin((ha * Math.PI) / 180)} y2={100 - 45 * Math.cos((ha * Math.PI) / 180)} className="stroke-ink" strokeWidth="10" strokeLinecap="round" />
      <line x1="100" y1="100" x2={100 + 68 * Math.sin((ma * Math.PI) / 180)} y2={100 - 68 * Math.cos((ma * Math.PI) / 180)} className="stroke-primary" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="100" r="7" className="fill-ink" />
    </svg>
  );
}

export function PuzzleVisual({ v, template }: { v: Visual; template?: string }) {
  if (v.type === "rows") return <CountingObjects rows={v.rows} />;
  if (v.type === "clock") return <Clock h={v.h} m={v.m} />;
  if (v.type === "coins") return <CoinTray coins={v.coins} />;
  if (v.type === "shapes") return <div className="flex flex-wrap justify-center gap-3">{v.shapes.map((s, i) => <ShapeSvg key={i} kind={s} />)}</div>;
  if (v.type === "equations") return template === "balance" ? <BalanceClues lines={v.lines} /> : <div className="flex flex-col items-center gap-2">{v.lines.map((l, i) => <div key={i} className="pz-equation">{l}</div>)}</div>;
  return (
    <div className="mx-auto grid w-fit grid-cols-3 gap-2">
      {v.grid.map((n, i) => <div key={i} className={cn("pz-cell", n === -1 && "pz-cell-glow")}>{n === -1 ? "❓" : n ?? ""}</div>)}
    </div>
  );
}

function CoinTray({ coins }: { coins: number[] }) {
  const [collected, setCollected] = useState<number[]>([]);
  return <div className="coin-tray" aria-label="Coin counting tray">{coins.map((c, i) => <Button variant="game" size="game" key={i} aria-label={`${c} cent coin ${i + 1}`} aria-pressed={collected.includes(i)} onClick={() => setCollected((old) => old.includes(i) ? old.filter((n) => n !== i) : [...old, i])} className={cn("pz-coin", c === 1 && "pz-coin-copper", c >= 25 && "pz-coin-big", collected.includes(i) && "coin-collected")}>{c}¢</Button>)}</div>;
}

function CountingObjects({ rows }: { rows: string[][] }) {
  const [touched, setTouched] = useState<string[]>([]);
  return <div className="flex flex-col items-center gap-2">{rows.map((row, i) => <div key={i} className="pz-row">{row.map((value, j) => {
    const id = `${i}-${j}`;
    const decorative = ["➕", "🟰", "❓", "🚩"].includes(value);
    return decorative ? <span key={id} className="world-object-symbol">{value}</span> : <Button key={id} variant="game" size="game" aria-label={`${value}, row ${i + 1}, item ${j + 1}`} aria-pressed={touched.includes(id)} className={cn("world-object", touched.includes(id) && "world-object-touched")} onClick={() => setTouched((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id])}>{value}</Button>;
  })}</div>)}</div>;
}

/* ---------- interactions ---------- */
function Choice({ k, report }: { k: Extract<Kind, { type: "choice" }>; report: Report }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className={cn("grid gap-3", k.options.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {k.options.map((o, i) => (
        <div className={cn("choice-socket", picked === i && "socket-filled")} key={i}><Key className={cn(k.bigOptions && "pz-key-big", picked === i && (i === k.answer ? "pz-key-right" : "pz-key-wrong"))} onClick={() => { setPicked(i); report(i === k.answer); }}><span className="choice-piece">{o}</span>{picked === i && <span className="scene-contact" aria-hidden="true"><i /><i /><i /></span>}</Key></div>
      ))}
    </div>
  );
}

function NumberPad({ k, report }: { k: Extract<Kind, { type: "number" }>; report: Report }) {
  const [v, setV] = useState("");
  return (
    <div className="mx-auto max-w-sm">
      <div className="pz-display scene-answer" aria-live="polite"><span key={v} className="answer-imprint">{v || <span className="opacity-30">?</span>}</span>{v && <span key={`contact-${v}`} className="scene-contact" aria-hidden="true"><i /><i /><i /></span>}</div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => <Key key={d} className="pz-key-pad" onClick={() => setV((x) => (x + d).slice(0, 4))}>{d}</Key>)}
        <Key className="pz-key-pad col-span-2" onClick={() => setV((x) => x.slice(0, -1))}>⌫</Key>
      </div>
      <CheckButton disabled={!v} onClick={() => report(Number(v) === k.answer)} />
    </div>
  );
}

function Order({ k, report }: { k: Extract<Kind, { type: "order" }>; report: Report }) {
  const [seq, setSeq] = useState<string[]>([]);
  return (
    <div>
      <div className="order-track flex flex-wrap justify-center gap-2">
        {k.answer.map((_, i) => (
          <Button variant="game" size="game" key={i} aria-label={`Position ${i + 1}${seq[i] ? `: ${seq[i]}, remove` : ": empty"}`} className={cn("pz-slot", seq[i] && "pz-slot-full")} onClick={() => seq[i] && setSeq(seq.filter((_, j) => j !== i))}>
            <small>{i === 0 ? k.first : i === k.answer.length - 1 ? k.last : i + 1}</small>
            <span key={seq[i]} className="placed-piece">{seq[i] ?? ""}</span>
          </Button>
        ))}
      </div>
      <div className="piece-rack mt-3 flex flex-wrap justify-center gap-2">
        {k.items.filter((x) => !seq.includes(x)).map((x) => <Key key={x} onClick={() => setSeq([...seq, x])}>{x}</Key>)}
      </div>
      <CheckButton disabled={seq.length < k.answer.length} onClick={() => report(seq.every((x, i) => x === k.answer[i]))} />
    </div>
  );
}

function Sudoku({ k, report }: { k: Extract<Kind, { type: "sudoku" }>; report: Report }) {
  const [cells, setCells] = useState<(number | null)[]>(k.given);
  const [sel, setSel] = useState<number | null>(k.given.findIndex((x) => x === null));
  const [carving, setCarving] = useState<{ cell: number; revision: number } | null>(null);
  return (
    <div className="forest-sudoku flex flex-col items-center">
      <div className="sudoku-tree-board">
        {cells.map((c, i) => {
          const fixed = k.given[i] !== null;
          return (
            <Button variant="game" size="game" key={i} aria-label={`Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}${c === null ? ", empty" : `, ${k.symbols[c]}`}`} aria-pressed={sel === i} disabled={fixed} onClick={() => setSel(i)} className={cn("pz-sudoku", fixed && "pz-sudoku-fixed", sel === i && "pz-sudoku-sel")}>
              {c !== null && <CarvedMark key={carving?.cell === i ? carving.revision : `fixed-${c}`} value={k.symbols[c] ?? ""} fresh={!fixed && carving?.cell === i} />}
            </Button>
          );
        })}
      </div>
      <div className="forest-number-rack mt-3 flex gap-2">
        {k.symbols.map((s, i) => <Key key={i} className="pz-key-big forest-number-tile" disabled={sel === null || sel < 0} onClick={() => { if (sel === null || sel < 0) return; setCells(cells.map((c, j) => (j === sel ? i : c))); setCarving((old) => ({ cell: sel, revision: (old?.revision ?? 0) + 1 })); }}><span className="sr-only">{s}</span>{/^\d+$/.test(s) ? <EngravedNumber value={s} /> : s}</Key>)}
      </div>
      <CheckButton disabled={cells.includes(null)} ready={!cells.includes(null)} onClick={() => report(cells.every((c, i) => c === k.solution[i]))} />
    </div>
  );
}

function Nim({ k, report }: { k: Extract<Kind, { type: "nim" }>; report: Report }) {
  const [left, setLeft] = useState(k.stones);
  const [turn, setTurn] = useState<"you" | "robot" | "done">("you");
  const [msg, setMsg] = useState("Your turn!");
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    if (turn !== "robot") return;
    const t = setTimeout(() => {
      const m = left % (k.maxTake + 1) || 1;
      const now = left - m;
      setLeft(now);
      if (now === 0) { setTurn("done"); setMsg(`Robo took ${m} and grabbed the last one!`); report(false); }
      else { setTurn("you"); setMsg(`Robo took ${m}. Your turn!`); }
    }, 800);
    return () => clearTimeout(t);
  }, [turn, left, k.maxTake, report]);
  const take = (n: number) => {
    setSelected([]);
    const now = left - n;
    setLeft(now);
    if (now === 0) { setTurn("done"); setMsg("You took the last one!"); report(true); }
    else { setTurn("robot"); setMsg("Robo is thinking… 🤖"); }
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="river-collection" aria-label="River stone game"><div className="nim-stone-bed">{Array.from({ length: k.stones }, (_, i) => <Button variant="game" size="game" key={i} disabled={i >= left || turn !== "you"} aria-label={`Stone ${i + 1}`} aria-pressed={selected.includes(i)} className={cn("nim-stone", i >= left && "nim-stone-taken", selected.includes(i) && "nim-stone-selected")} onClick={() => setSelected((old) => old.includes(i) ? old.filter((n) => n !== i) : old.length < k.maxTake ? [...old, i] : old)}><span>{i + 1}</span></Button>)}</div><div className="river-catch" aria-hidden="true">{k.stones - left > 0 && <span key={left}>{k.stones - left}</span>}</div></div>
      <p className="world-status font-display text-xl font-semibold">{left} left · {msg}</p>
      {turn === "done" ? (
        <Key onClick={() => { setLeft(k.stones); setSelected([]); setTurn("you"); setMsg("Your turn!"); }}>Play again 🔁</Key>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">{selected.length ? <Key disabled={turn !== "you"} onClick={() => take(selected.length)}>Collect {selected.length}</Key> : Array.from({ length: k.maxTake }, (_, i) => i + 1).map((n) => <Key key={n} disabled={turn !== "you" || n > left} onClick={() => take(n)}>Take {n}</Key>)}</div>
      )}
    </div>
  );
}

export function PuzzleBody({ spec, report }: { spec: PuzzleSpec; report: Report }) {
  const k = spec.kind;
  return (
    <PuzzleWorld template={spec.template}><div className="flex flex-col gap-4">
      <SceneClues spec={spec} />
      {spec.visual && spec.template !== "share" && <PuzzleVisual v={spec.visual} template={spec.template} />}
      {k.type === "choice" && <Choice k={k} report={report} />}
      {k.type === "number" && <NumberPad k={k} report={report} />}
      {k.type === "order" && <Order k={k} report={report} />}
      {k.type === "sudoku" && <Sudoku k={k} report={report} />}
      {k.type === "nim" && <Nim k={k} report={report} />}
    </div></PuzzleWorld>
  );
}
