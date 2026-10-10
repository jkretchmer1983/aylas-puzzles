import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Btn, CheckBtn, NumberAnswer, SelectOne, SlotAssign, Stepper, type PuzzleProps } from "./kit";

const T = ({ children }: { children: ReactNode }) => <span className="font-display text-2xl font-bold">{children}</span>;

/* ---------- Generic: place digits into spots ---------- */
function Place({
  report,
  spots,
  givens = {},
  digits,
  check,
  bg,
  size = "h-14 w-14",
}: PuzzleProps & {
  spots: { x: number; y: number }[];
  givens?: Record<number, number>;
  digits: number[];
  check: (v: (number | undefined)[]) => boolean;
  bg?: ReactNode;
  size?: string;
}) {
  const [vals, setVals] = useState<(number | undefined)[]>(() => spots.map((_, i) => givens[i]));
  const [active, setActive] = useState<number | null>(null);
  const set = (d: number | undefined) =>
    active !== null && setVals((v) => v.map((x, i) => (i === active ? d : x)));
  return (
    <>
      <div className="relative mx-auto aspect-square w-full max-w-sm">
        {bg && <div className="pointer-events-none absolute inset-0">{bg}</div>}
        {spots.map((s, i) => {
          const g = givens[i] !== undefined;
          return (
            <button
              key={i}
              disabled={g}
              onClick={() => setActive(i)}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 font-display text-3xl font-bold",
                size,
                g ? "border-ink/40 bg-muted" : "border-primary bg-card",
                active === i && "border-accent bg-accent/40",
              )}
            >
              {vals[i] ?? ""}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {digits.map((d) => (
          <button key={d} onClick={() => set(d)} className="tile h-14 w-14 font-display text-3xl font-bold">{d}</button>
        ))}
        <Btn variant="ghost" onClick={() => set(undefined)}>Erase</Btn>
      </div>
      <CheckBtn onCheck={() => report(vals.every((v) => v !== undefined) && check(vals))} />
    </>
  );
}

const sum = (v: (number | undefined)[], idx: number[]) => idx.reduce((a, i) => a + (v[i] ?? 0), 0);
const distinct = (v: (number | undefined)[]) => new Set(v).size === v.length;
const gridSpots = (n: number) =>
  Array.from({ length: n * n }, (_, i) => ({ x: (100 / n) * ((i % n) + 0.5), y: (100 / n) * (Math.floor(i / n) + 0.5) }));

/* ---------- Generic: take-away / count-up game vs robot ---------- */
function StoneGame({ report, n, max, misere, countUp }: PuzzleProps & { n: number; max: number; misere?: boolean; countUp?: number }) {
  const [left, setLeft] = useState(n);
  const [log, setLog] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const robot = (l: number) => {
    let t = (misere ? l - 1 : l) % (max + 1);
    if (t === 0) t = 1;
    return Math.min(t, l);
  };
  const verb = countUp ? "add" : "take";
  const take = (k: number) => {
    if (over || k > left) return;
    let l = left - k;
    const lg = [`You ${verb} ${k}`];
    if (l === 0) {
      setOver(true);
      report(!misere);
    } else {
      const r = robot(l);
      l -= r;
      lg.push(`Robot ${verb}s ${r}`);
      if (l === 0) {
        setOver(true);
        report(!!misere);
      }
    }
    setLeft(l);
    setLog((x) => [...x, ...lg]);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      {countUp ? (
        <div className="flex h-24 min-w-36 items-center justify-center rounded-2xl border-4 border-ink bg-ink px-6 font-mono text-6xl font-bold text-sun">
          {n - left}
        </div>
      ) : (
        <div className="flex max-w-md flex-wrap justify-center gap-2">
          {Array.from({ length: left }, (_, i) => (
            <span key={i} className="h-8 w-8 rounded-full border-4 border-ink/40 bg-muted-foreground/40" />
          ))}
        </div>
      )}
      <p className="font-display text-xl">{countUp ? `Goal: ${countUp}` : `${left} stones left`}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
          <Btn key={k} disabled={over || k > left} onClick={() => take(k)}>
            {countUp ? `+${k}` : `Take ${k}`}
          </Btn>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-lg">
        {log.map((l, i) => (
          <span key={i} className={cn("rounded-full px-3 py-1", l.startsWith("You") ? "bg-secondary" : "bg-muted")}>{l}</span>
        ))}
      </div>
      <Btn variant="ghost" onClick={() => { setLeft(n); setLog([]); setOver(false); }}>Start over</Btn>
    </div>
  );
}

/* ================= Age 8 ================= */

export function C1({ report }: PuzzleProps) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  return (
    <Place report={report} spots={gridSpots(3)} givens={{ 0: 2, 2: 6, 4: 5 }} digits={[1, 2, 3, 4, 5, 6, 7, 8, 9]} size="h-20 w-20"
      check={(v) => distinct(v) && lines.every((l) => sum(v, l) === 15)} />
  );
}

export function C2({ report }: PuzzleProps) {
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-center gap-3 font-display text-4xl font-bold">
        {[1, 2, 4, 7, 11].map((n) => <span key={n} className="tile px-4 py-2">{n}</span>)}
        <span className="tile px-4 py-2 text-primary">?</span>
      </div>
      <NumberAnswer correct={16} report={report} />
    </>
  );
}

export function C3({ report }: PuzzleProps) {
  return (
    <SlotAssign report={report}
      items={[{ id: "cat", label: "Cat", emoji: "🐱" }, { id: "dog", label: "Dog", emoji: "🐶" }, { id: "fish", label: "Fish", emoji: "🐟" }]}
      slots={[{ id: "ana", label: "Ana" }, { id: "ben", label: "Ben" }, { id: "cal", label: "Cal" }]}
      answer={{ ana: "fish", ben: "cat", cal: "dog" }} />
  );
}

export function C4({ report }: PuzzleProps) {
  return <StoneGame report={report} n={10} max={2} />;
}

export function C5({ report }: PuzzleProps) {
  return (
    <>
      <svg viewBox="0 0 200 190" className="mx-auto mb-6 w-full max-w-xs">
        <polygon points="100,10 10,180 190,180" className="fill-sun/40 stroke-ink" strokeWidth="5" strokeLinejoin="round" />
        <line x1="100" y1="10" x2="70" y2="180" className="stroke-ink" strokeWidth="5" />
        <line x1="100" y1="10" x2="130" y2="180" className="stroke-ink" strokeWidth="5" />
      </svg>
      <NumberAnswer correct={6} report={report} unit="triangles" />
    </>
  );
}

export function C6({ report }: PuzzleProps) {
  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3 font-display text-3xl font-bold">
        <div className="flex items-center gap-2"><span className="text-4xl">🔺</span>+<span className="text-4xl">🔺</span>=<span className="text-4xl">🟦</span></div>
        <div className="flex items-center gap-2"><span className="text-4xl">🟦</span>+<span className="text-4xl">🔺</span>= 9</div>
        <div className="flex items-center gap-2"><span className="text-4xl">🔺</span>= ?</div>
      </div>
      <NumberAnswer correct={3} report={report} />
    </>
  );
}

export function C7({ report }: PuzzleProps) {
  return (
    <SelectOne report={report} correct="29" cols={5}
      options={[12, 18, 24, 29, 30].map((n) => ({ id: String(n), node: <span className="font-display text-5xl font-bold">{n}</span> }))} />
  );
}

export function C8({ report }: PuzzleProps) {
  return <NumberAnswer correct={9} report={report} unit="o'clock" />;
}

export function C9({ report }: PuzzleProps) {
  const [c, setC] = useState({ 5: 0, 10: 0, 25: 0 });
  const total = c[5] * 5 + c[10] * 10 + c[25] * 25;
  const count = c[5] + c[10] + c[25];
  return (
    <>
      <div className="flex flex-wrap justify-center gap-8">
        {([5, 10, 25] as const).map((v) => (
          <Stepper key={v} value={c[v]} max={6} onChange={(n) => setC((x) => ({ ...x, [v]: n }))}
            label={<span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink/40 bg-sun font-display text-xl font-bold">{v}¢</span>} />
        ))}
      </div>
      <p className="mt-6 text-center font-display text-2xl">{count} coins · {total}¢</p>
      <CheckBtn onCheck={() => report(total === 30 && count === 4)} />
    </>
  );
}

export function C10({ report }: PuzzleProps) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return <SelectOne report={report} correct="Saturday" cols={4} options={days.map((d) => ({ id: d, node: <T>{d}</T> }))} />;
}

/* ================= Age 9 ================= */

export function C11({ report }: PuzzleProps) {
  const groups: number[][] = [];
  for (let i = 0; i < 4; i++) {
    groups.push([0, 1, 2, 3].map((c) => i * 4 + c));
    groups.push([0, 1, 2, 3].map((r) => r * 4 + i));
  }
  for (const b of [0, 2, 8, 10]) groups.push([b, b + 1, b + 4, b + 5]);
  return (
    <Place report={report} spots={gridSpots(4)} givens={{ 0: 1, 3: 4, 5: 4, 6: 1, 9: 1, 10: 4, 12: 4, 15: 1 }} digits={[1, 2, 3, 4]} size="h-16 w-16"
      bg={<svg viewBox="0 0 100 100" className="h-full w-full"><line x1="50" y1="0" x2="50" y2="100" className="stroke-ink" strokeWidth="1.5" /><line x1="0" y1="50" x2="100" y2="50" className="stroke-ink" strokeWidth="1.5" /></svg>}
      check={(v) => groups.every((g) => new Set(g.map((i) => v[i])).size === 4)} />
  );
}

export function C12({ report }: PuzzleProps) {
  const o = [["tt", "A truthful, B truthful"], ["tl", "A truthful, B lies"], ["lt", "A lies, B truthful"], ["ll", "A lies, B lies"]];
  return (
    <>
      <p className="mb-4 text-center text-xl">🤖 A says: “We are BOTH liars.”</p>
      <SelectOne report={report} correct="lt" cols={2} options={o.map(([id, l]) => ({ id, node: <T>{l}</T> }))} />
    </>
  );
}

export function C13({ report }: PuzzleProps) {
  return <StoneGame report={report} n={15} max={3} misere />;
}

export function C14({ report }: PuzzleProps) {
  return <NumberAnswer correct={10} report={report} unit="years" />;
}

export function C15({ report }: PuzzleProps) {
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-center gap-3 font-display text-4xl font-bold">
        {[2, 6, 12, 20, 30].map((n) => <span key={n} className="tile px-4 py-2">{n}</span>)}
        <span className="tile px-4 py-2 text-primary">?</span>
      </div>
      <NumberAnswer correct={42} report={report} />
    </>
  );
}

export function C16({ report }: PuzzleProps) {
  return (
    <>
      <svg viewBox="-5 -5 160 160" className="mx-auto mb-6 w-full max-w-[14rem]">
        {[0, 50, 100, 150].map((p) => (
          <g key={p}>
            <line x1={p} y1="0" x2={p} y2="150" className="stroke-ink" strokeWidth="5" />
            <line x1="0" y1={p} x2="150" y2={p} className="stroke-ink" strokeWidth="5" />
          </g>
        ))}
      </svg>
      <NumberAnswer correct={14} report={report} unit="squares" />
    </>
  );
}

export function C17({ report }: PuzzleProps) {
  return (
    <SlotAssign report={report}
      items={[{ id: "ann", label: "Ann" }, { id: "bo", label: "Bo" }, { id: "cal", label: "Cal" }, { id: "dee", label: "Dee" }]}
      slots={[1, 2, 3, 4].map((n) => ({ id: `s${n}`, label: `Seat ${n}` }))}
      answer={{ s1: "dee", s2: "bo", s3: "ann", s4: "cal" }} />
  );
}

export function C18({ report }: PuzzleProps) {
  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-2 font-display text-2xl font-semibold">
        <span>🟥 + 🟦 = 10 kg</span>
        <span>🟦 + 🟩 = 12 kg</span>
        <span>🟥 + 🟩 = 8 kg</span>
      </div>
      <NumberAnswer correct={7} report={report} unit="kg" />
    </>
  );
}

export function C19({ report }: PuzzleProps) {
  const [on, setOn] = useState([false, false, false, false, false]);
  const tap = (i: number) => setOn((o) => o.map((x, j) => (Math.abs(i - j) <= 1 ? !x : x)));
  return (
    <>
      <div className="flex justify-center gap-2 sm:gap-4">
        {on.map((x, i) => (
          <button key={i} onClick={() => tap(i)}
            className={cn("h-16 w-16 rounded-full border-4 border-ink/40 text-3xl transition sm:h-20 sm:w-20", x ? "bg-sun shadow-[0_0_24px] shadow-sun" : "bg-muted")}>
            {x ? "💡" : ""}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <Btn variant="ghost" onClick={() => setOn([false, false, false, false, false])}>All off</Btn>
      </div>
      <CheckBtn onCheck={() => report(on.every(Boolean))} />
    </>
  );
}

export function C20({ report }: PuzzleProps) {
  return <NumberAnswer correct={15} report={report} unit="handshakes" />;
}

/* ================= Age 10 ================= */

export function C21({ report }: PuzzleProps) {
  const b = [["A", "The gold is in this box."], ["B", "The gold is NOT in this box."], ["C", "The gold is NOT in box A."]];
  return (
    <SelectOne report={report} correct="B" cols={3}
      options={b.map(([id, s]) => ({ id, label: `Box ${id}`, node: <div className="flex flex-col items-center gap-2"><span className="text-5xl">📦</span><span className="text-base">“{s}”</span></div> }))} />
  );
}

export function C22({ report }: PuzzleProps) {
  return <NumberAnswer correct={47} report={report} />;
}

export function C23({ report }: PuzzleProps) {
  return <StoneGame report={report} n={31} max={4} countUp={31} />;
}

export function C24({ report }: PuzzleProps) {
  const spots = [{ x: 50, y: 10 }, { x: 12, y: 86 }, { x: 88, y: 86 }, { x: 31, y: 48 }, { x: 69, y: 48 }, { x: 50, y: 86 }];
  const sides = [[0, 3, 1], [0, 4, 2], [1, 5, 2]];
  return (
    <Place report={report} spots={spots} digits={[1, 2, 3, 4, 5, 6]}
      bg={<svg viewBox="0 0 100 100" className="h-full w-full"><polygon points="50,10 12,86 88,86" className="fill-leaf/20 stroke-ink" strokeWidth="1.5" /></svg>}
      check={(v) => distinct(v) && sides.every((s) => sum(v, s) === 9)} />
  );
}

export function C25({ report }: PuzzleProps) {
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-center gap-3 font-display text-4xl font-bold">
        {[1, 1, 2, 3, 5, 8, 13].map((n, i) => <span key={i} className="tile px-4 py-2">{n}</span>)}
        <span className="tile px-4 py-2 text-primary">?</span>
      </div>
      <NumberAnswer correct={21} report={report} />
    </>
  );
}

export function C26({ report }: PuzzleProps) {
  const r = ["Kim", "Lou", "Max", "Ned", "Oli"];
  return (
    <SlotAssign report={report}
      items={r.map((n) => ({ id: n, label: n }))}
      slots={["1st", "2nd", "3rd", "4th", "5th"].map((l) => ({ id: l, label: l }))}
      answer={{ "1st": "Oli", "2nd": "Kim", "3rd": "Ned", "4th": "Max", "5th": "Lou" }} />
  );
}

export function C27({ report }: PuzzleProps) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [log, setLog] = useState(0);
  const act = (fa: number, fb: number) => { setA(fa); setB(fb); setLog((n) => n + 1); };
  const jug = (v: number, cap: number) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 overflow-hidden rounded-b-2xl border-4 border-ink bg-card" style={{ height: cap * 28 }}>
        <div className="absolute inset-x-0 bottom-0 bg-sky transition-all" style={{ height: v * 28 }} />
      </div>
      <span className="font-display text-2xl font-bold">{v} / {cap} L</span>
    </div>
  );
  return (
    <>
      <div className="flex items-end justify-center gap-10">{jug(a, 3)}{jug(b, 5)}</div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Btn onClick={() => act(3, b)}>Fill 3 L</Btn>
        <Btn onClick={() => act(a, 5)}>Fill 5 L</Btn>
        <Btn variant="soft" onClick={() => { const m = Math.min(a, 5 - b); act(a - m, b + m); }}>Pour 3 → 5</Btn>
        <Btn variant="ghost" onClick={() => act(0, b)}>Empty 3 L</Btn>
        <Btn variant="ghost" onClick={() => act(a, 0)}>Empty 5 L</Btn>
        <Btn variant="soft" onClick={() => { const m = Math.min(b, 3 - a); act(a + m, b - m); }}>Pour 5 → 3</Btn>
      </div>
      <p className="mt-4 text-center text-lg text-muted-foreground">Steps: {log}</p>
      <CheckBtn onCheck={() => report(a === 4 || b === 4)} />
    </>
  );
}

export function C28({ report }: PuzzleProps) {
  return (
    <>
      <svg viewBox="-30 -20 210 200" className="mx-auto mb-6 w-full max-w-[16rem]">
        {[0, 50, 100, 150].map((p) => (
          <g key={p}>
            <line x1={p} y1="0" x2={p} y2="150" className="stroke-ink" strokeWidth="4" />
            <line x1="0" y1={p} x2="150" y2={p} className="stroke-ink" strokeWidth="4" />
          </g>
        ))}
        <circle cx="0" cy="150" r="9" className="fill-leaf stroke-ink" strokeWidth="3" />
        <circle cx="150" cy="0" r="9" className="fill-berry stroke-ink" strokeWidth="3" />
        <text x="-25" y="175" className="fill-foreground font-display text-[16px] font-bold">START</text>
        <text x="125" y="-6" className="fill-foreground font-display text-[16px] font-bold">HOME</text>
      </svg>
      <NumberAnswer correct={20} report={report} unit="routes" />
    </>
  );
}

export function C29({ report }: PuzzleProps) {
  const init = () => [[3, 2, 1], [], []] as number[][];
  const [pegs, setPegs] = useState(init);
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const tap = (i: number) => {
    if (sel === null) { if (pegs[i].length) setSel(i); return; }
    const from = pegs[sel], to = pegs[i];
    const d = from[from.length - 1];
    if (i !== sel && (!to.length || to[to.length - 1] > d)) {
      setPegs((p) => p.map((x, j) => (j === sel ? x.slice(0, -1) : j === i ? [...x, d] : x)));
      setMoves((m) => m + 1);
    }
    setSel(null);
  };
  const colors = ["", "bg-berry", "bg-sun", "bg-sky"];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {pegs.map((p, i) => (
          <button key={i} onClick={() => tap(i)} className={cn("tile relative flex h-48 flex-col-reverse items-center justify-start gap-1 p-2 pb-4", sel === i && "tile-on")}>
            <span className="absolute bottom-3 top-6 left-1/2 w-2 -translate-x-1/2 rounded bg-ink/40" />
            {p.map((d, k) => (
              <span key={d} className={cn("relative h-7 rounded-lg border-4 border-ink/40", colors[d], sel === i && k === p.length - 1 && "-translate-y-2")} style={{ width: `${30 + d * 22}%` }} />
            ))}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center font-display text-2xl">Moves: {moves}</p>
      <div className="mt-2 flex justify-center">
        <Btn variant="ghost" onClick={() => { setPegs(init()); setMoves(0); setSel(null); }}>Start over</Btn>
      </div>
      <CheckBtn onCheck={() => report(pegs[2].length === 3 && moves <= 7)} />
    </>
  );
}

export function C30({ report }: PuzzleProps) {
  const f = (pts: string) => <polygon points={pts} className="stroke-ink" strokeWidth="2" strokeLinejoin="round" />;
  return (
    <>
      <svg viewBox="0 0 160 150" className="mx-auto mb-6 w-full max-w-[14rem]">
        <g className="fill-berry">
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <g key={`f${r}${c}`}>{f(`${10 + c * 30},${50 + r * 30} ${40 + c * 30},${50 + r * 30} ${40 + c * 30},${80 + r * 30} ${10 + c * 30},${80 + r * 30}`)}</g>))}
        </g>
        <g className="fill-sun">
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => { const y = 50 - (r + 1) * 13, x = 10 + (r + 1) * 13 + c * 30; return <g key={`t${r}${c}`}>{f(`${x - 13},${y + 13} ${x + 17},${y + 13} ${x + 30},${y} ${x},${y}`)}</g>; }))}
        </g>
        <g className="fill-sky">
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => { const x = 100 + c * 13, y = 50 + r * 30 - c * 13; return <g key={`s${r}${c}`}>{f(`${x},${y} ${x + 13},${y - 13} ${x + 13},${y + 17} ${x},${y + 30}`)}</g>; }))}
        </g>
      </svg>
      <NumberAnswer correct={12} report={report} unit="cubes" />
    </>
  );
}
