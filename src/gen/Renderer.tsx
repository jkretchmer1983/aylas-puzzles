import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Kind, PuzzleSpec, ShapeName, Visual } from "./types";

type Report = (ok: boolean) => void;

function Key({ children, onClick, className, disabled }: { children: React.ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cn("pz-key", className)}>
      {children}
    </button>
  );
}

function CheckButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="mt-4 flex justify-center">
      <button disabled={disabled} onClick={onClick} className="pz-check">Check my answer ✓</button>
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

export function PuzzleVisual({ v }: { v: Visual }) {
  if (v.type === "rows") return <div className="flex flex-col items-center gap-2">{v.rows.map((r, i) => <div key={i} className="pz-row">{r.map((e, j) => <span key={j} className="pz-emoji" style={{ animationDelay: `${j * 60}ms` }}>{e}</span>)}</div>)}</div>;
  if (v.type === "clock") return <Clock h={v.h} m={v.m} />;
  if (v.type === "coins") return <div className="flex flex-wrap justify-center gap-2">{v.coins.map((c, i) => <span key={i} className={cn("pz-coin", c === 1 && "pz-coin-copper", c >= 25 && "pz-coin-big")}>{c}¢</span>)}</div>;
  if (v.type === "shapes") return <div className="flex flex-wrap justify-center gap-3">{v.shapes.map((s, i) => <ShapeSvg key={i} kind={s} />)}</div>;
  if (v.type === "equations") return <div className="flex flex-col items-center gap-2">{v.lines.map((l, i) => <div key={i} className="pz-equation">{l}</div>)}</div>;
  return (
    <div className="mx-auto grid w-fit grid-cols-3 gap-2">
      {v.grid.map((n, i) => <div key={i} className={cn("pz-cell", n === -1 && "pz-cell-glow")}>{n === -1 ? "❓" : n ?? ""}</div>)}
    </div>
  );
}

/* ---------- interactions ---------- */
function Choice({ k, report }: { k: Extract<Kind, { type: "choice" }>; report: Report }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className={cn("grid gap-3", k.options.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {k.options.map((o, i) => (
        <Key key={i} className={cn(k.bigOptions && "pz-key-big", picked === i && (i === k.answer ? "pz-key-right" : "pz-key-wrong"))} onClick={() => { setPicked(i); report(i === k.answer); }}>{o}</Key>
      ))}
    </div>
  );
}

function NumberPad({ k, report }: { k: Extract<Kind, { type: "number" }>; report: Report }) {
  const [v, setV] = useState("");
  return (
    <div className="mx-auto max-w-sm">
      <div className="pz-display" aria-live="polite">{v || <span className="opacity-30">?</span>}</div>
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
      <div className="flex flex-wrap justify-center gap-2">
        {k.answer.map((_, i) => (
          <button key={i} className={cn("pz-slot", seq[i] && "pz-slot-full")} onClick={() => seq[i] && setSeq(seq.filter((_, j) => j !== i))}>
            <small>{i === 0 ? k.first : i === k.answer.length - 1 ? k.last : i + 1}</small>
            <span>{seq[i] ?? ""}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {k.items.filter((x) => !seq.includes(x)).map((x) => <Key key={x} onClick={() => setSeq([...seq, x])}>{x}</Key>)}
      </div>
      <CheckButton disabled={seq.length < k.answer.length} onClick={() => report(seq.every((x, i) => x === k.answer[i]))} />
    </div>
  );
}

function Sudoku({ k, report }: { k: Extract<Kind, { type: "sudoku" }>; report: Report }) {
  const [cells, setCells] = useState<(number | null)[]>(k.given);
  const [sel, setSel] = useState<number | null>(k.given.findIndex((x) => x === null));
  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-ink/80 p-1.5">
        {cells.map((c, i) => {
          const fixed = k.given[i] !== null;
          return (
            <button key={i} disabled={fixed} onClick={() => setSel(i)} className={cn("pz-sudoku", fixed && "pz-sudoku-fixed", sel === i && "pz-sudoku-sel", i % 4 === 1 && "mr-1", Math.floor(i / 4) === 1 && "mb-1")}>
              {c === null ? "" : k.symbols[c]}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        {k.symbols.map((s, i) => <Key key={i} className="pz-key-big" disabled={sel === null} onClick={() => sel !== null && setCells(cells.map((c, j) => (j === sel ? i : c)))}>{s}</Key>)}
      </div>
      <CheckButton disabled={cells.includes(null)} onClick={() => report(cells.every((c, i) => c === k.solution[i]))} />
    </div>
  );
}

function Nim({ k, report }: { k: Extract<Kind, { type: "nim" }>; report: Report }) {
  const [left, setLeft] = useState(k.stones);
  const [turn, setTurn] = useState<"you" | "robot" | "done">("you");
  const [msg, setMsg] = useState("Your turn!");
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
    const now = left - n;
    setLeft(now);
    if (now === 0) { setTurn("done"); setMsg("You took the last one!"); report(true); }
    else { setTurn("robot"); setMsg("Robo is thinking… 🤖"); }
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex max-w-md flex-wrap justify-center gap-1">{Array.from({ length: left }, (_, i) => <span key={i} className="pz-emoji text-3xl">{k.icon}</span>)}</div>
      <p className="font-display text-xl font-semibold">{left} left · {msg}</p>
      {turn === "done" ? (
        <Key onClick={() => { setLeft(k.stones); setTurn("you"); setMsg("Your turn!"); }}>Play again 🔁</Key>
      ) : (
        <div className="flex gap-2">{Array.from({ length: k.maxTake }, (_, i) => i + 1).map((n) => <Key key={n} disabled={turn !== "you" || n > left} onClick={() => take(n)}>Take {n}</Key>)}</div>
      )}
    </div>
  );
}

export function PuzzleBody({ spec, report }: { spec: PuzzleSpec; report: Report }) {
  const k = spec.kind;
  return (
    <div className="flex flex-col gap-4">
      {spec.visual && <PuzzleVisual v={spec.visual} />}
      {k.type === "choice" && <Choice k={k} report={report} />}
      {k.type === "number" && <NumberPad k={k} report={report} />}
      {k.type === "order" && <Order k={k} report={report} />}
      {k.type === "sudoku" && <Sudoku k={k} report={report} />}
      {k.type === "nim" && <Nim k={k} report={report} />}
    </div>
  );
}
