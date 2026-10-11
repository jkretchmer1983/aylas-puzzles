import { useState } from "react";
import { cn } from "@/lib/utils";
import { Btn, CheckBtn, NumberAnswer, SelectOne, Stepper, YesNo, type PuzzleProps } from "./kit";

/* 21 */
export function P21({ report }: PuzzleProps) {
  const [codes, setCodes] = useState<number[][]>([[], []]);
  const [active, setActive] = useState(0);
  const add = (d: number) =>
    setCodes((c) => c.map((x, i) => (i === active && x.length < 3 && !x.includes(d) ? [...x, d] : x)));
  return (
    <>
      <div className="flex flex-wrap justify-center gap-8">
        {codes.map((c, i) => (
          <button key={i} onClick={() => setActive(i)} className={cn("tile flex gap-2 p-4", active === i && "tile-on")}>
            {[0, 1, 2].map((k) => (
              <span key={k} className="flex h-16 w-14 items-center justify-center rounded-lg border-4 border-ink/30 bg-card font-display text-4xl font-bold">
                {c[k] ?? ""}
              </span>
            ))}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-4">
        {[2, 4, 6].map((d) => (
          <button key={d} onClick={() => add(d)} className="tile h-20 w-20 bg-accent font-display text-4xl font-bold">{d}</button>
        ))}
        <Btn variant="ghost" onClick={() => setCodes((c) => c.map((x, i) => (i === active ? [] : x)))}>Clear</Btn>
      </div>
      <CheckBtn
        onCheck={() => {
          const s = codes.map((c) => c.join("")).sort().join();
          report(s === "462,624");
        }}
      />
    </>
  );
}

/* 22 & 35 — command machines */
function Machine({ report, start, cmds, done }: PuzzleProps & { start: number; cmds: { label: string; f: (n: number) => number }[]; done: (h: number[]) => boolean }) {
  const [hist, setHist] = useState<number[]>([start]);
  const [ops, setOps] = useState<string[]>([]);
  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <span className="text-7xl">🤖</span>
          <div className="flex h-24 min-w-36 items-center justify-center rounded-2xl border-4 border-ink bg-ink px-6 font-mono text-6xl font-bold text-sun">
            {hist[hist.length - 1]}
          </div>
        </div>
        <div className="flex gap-4">
          {cmds.map((c) => (
            <Btn key={c.label} onClick={() => { setHist((h) => [...h, c.f(h[h.length - 1])]); setOps((o) => [...o, c.label]); }}>
              {c.label}
            </Btn>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 font-display text-xl">
          {hist.map((n, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-sm text-muted-foreground">{ops[i - 1]} →</span>}
              <span className="rounded-lg bg-secondary px-3 py-1 font-bold">{n}</span>
            </span>
          ))}
        </div>
        <p className="font-display text-lg text-muted-foreground">Commands used: {ops.length}</p>
        <div className="flex gap-3">
          <Btn variant="ghost" onClick={() => { setHist((h) => (h.length > 1 ? h.slice(0, -1) : h)); setOps((o) => o.slice(0, -1)); }}>Undo</Btn>
          <Btn variant="ghost" onClick={() => { setHist([start]); setOps([]); }}>Start over</Btn>
        </div>
      </div>
      <CheckBtn onCheck={() => report(done(hist))} />
    </>
  );
}
export const P22 = (p: PuzzleProps) => (
  <Machine {...p} start={0} cmds={[{ label: "ADD 3", f: (n) => n + 3 }, { label: "TAKE AWAY 2", f: (n) => n - 2 }]} done={(h) => h.length === 5 && h[4] === 7} />
);

/* 23 — coin weighing */
export function P23({ report }: PuzzleProps) {
  const [side, setSide] = useState<("off" | "L" | "R")[]>(Array(9).fill("off"));
  const cycle = (i: number) => setSide((s) => s.map((x, j) => (j === i ? (x === "off" ? "L" : x === "L" ? "R" : "off") : x)));
  const L = side.filter((x) => x === "L").length, R = side.filter((x) => x === "R").length;
  const coin = (i: number) => (
    <button key={i} onClick={() => cycle(i)} className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-ink/50 bg-sun font-display text-xl font-bold active:scale-90">
      {i + 1}
    </button>
  );
  return (
    <>
      <div className="flex justify-center gap-3 sm:gap-10">
        {(["L", "R"] as const).map((s) => (
          <div key={s} className="flex min-w-0 flex-col items-center">
            <div className="flex min-h-20 w-[44vw] max-w-56 flex-wrap items-end justify-center gap-1 border-b-8 border-ink pb-1">
              {side.map((x, i) => (x === s ? coin(i) : null))}
            </div>
            <span className="mt-1 font-display text-lg">{s === "L" ? "Left pan" : "Right pan"} ({s === "L" ? L : R})</span>
          </div>
        ))}
      </div>
      <div className="mx-auto h-24 w-3 bg-ink" />
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border-4 border-dashed border-border p-3">
        {side.map((x, i) => (x === "off" ? coin(i) : null))}
      </div>
      <p className="mt-2 text-center text-muted-foreground">Tap a coin once for the left pan, twice for the right pan, three times to take it off.</p>
      <CheckBtn onCheck={() => report(L === 3 && R === 3)} />
    </>
  );
}

/* 24 */
export function P24({ report }: PuzzleProps) {
  return (
    <SelectOne
      correct="both"
      report={report}
      options={["CHOCOLATE", "JELLY BEANS", "BOTH"].map((l) => ({
        id: l === "BOTH" ? "both" : l,
        label: l,
        node: <span className="text-7xl">🎁</span>,
      }))}
    />
  );
}

/* 25 — toothpicks */
export function P25({ report }: PuzzleProps) {
  const sticks: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r <= 2; r++) for (let c = 0; c < 2; c++) sticks.push({ id: `h${r}${c}`, x1: c, y1: r, x2: c + 1, y2: r });
  for (let r = 0; r < 2; r++) for (let c = 0; c <= 2; c++) sticks.push({ id: `v${r}${c}`, x1: c, y1: r, x2: c, y2: r + 1 });
  const [gone, setGone] = useState<string[]>([]);
  const has = (id: string) => !gone.includes(id);
  const sq = (r: number, c: number) => [`h${r}${c}`, `h${r + 1}${c}`, `v${r}${c}`, `v${r}${c + 1}`];
  return (
    <>
      <svg viewBox="-0.3 -0.3 2.6 2.6" className="mx-auto w-full max-w-sm">
        {sticks.map((s) => (
          <g key={s.id} onClick={() => setGone((g) => (g.includes(s.id) ? g.filter((x) => x !== s.id) : [...g, s.id]))} className="cursor-pointer">
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth="0.3" />
            <line
              x1={s.x1 + (s.x2 - s.x1) * 0.08} y1={s.y1 + (s.y2 - s.y1) * 0.08}
              x2={s.x2 - (s.x2 - s.x1) * 0.08} y2={s.y2 - (s.y2 - s.y1) * 0.08}
              className={has(s.id) ? "stroke-sun" : "stroke-muted"}
              strokeWidth="0.09" strokeLinecap="round"
            />
            {!has(s.id) && <text x={(s.x1 + s.x2) / 2} y={(s.y1 + s.y2) / 2 + 0.08} fontSize="0.25" textAnchor="middle" className="fill-destructive font-bold">✕</text>}
          </g>
        ))}
      </svg>
      <p className="text-center font-display text-xl">Removed: {gone.length} / 4</p>
      <CheckBtn
        onCheck={() => {
          const full = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([r, c]) => sq(r, c)).filter((s) => s.every(has));
          const used = new Set(full.flat());
          report(gone.length === 4 && full.length === 2 && sticks.filter((s) => has(s.id)).every((s) => used.has(s.id)));
        }}
      />
    </>
  );
}

/* 26 — river crossing */
type Thing = "wolf" | "goat" | "cabbage";
const EMO: Record<Thing, string> = { wolf: "🐺", goat: "🐐", cabbage: "🥬" };
export function P26({ report }: PuzzleProps) {
  const [side, setSide] = useState<Record<Thing | "you", "L" | "R">>({ you: "L", wolf: "L", goat: "L", cabbage: "L" });
  const [boat, setBoat] = useState<Thing | null>(null);
  const [trips, setTrips] = useState(0);
  const [msg, setMsg] = useState("");
  const reset = () => { setSide({ you: "L", wolf: "L", goat: "L", cabbage: "L" }); setBoat(null); setTrips(0); setMsg(""); };
  const row = () => {
    const to = side.you === "L" ? "R" : "L";
    const n = { ...side, you: to, ...(boat ? { [boat]: to } : {}) } as typeof side;
    setSide(n); setBoat(null); setTrips((t) => t + 1);
    const alone = (["wolf", "goat", "cabbage"] as Thing[]).filter((t) => n[t] !== n.you);
    if (alone.includes("wolf") && alone.includes("goat")) { setMsg("Oh no! The wolf ate the goat."); report(false); return; }
    if (alone.includes("goat") && alone.includes("cabbage")) { setMsg("Oh no! The goat ate the cabbage."); report(false); return; }
    if (n.wolf === "R" && n.goat === "R" && n.cabbage === "R" && n.you === "R") report(true);
  };
  const bank = (s: "L" | "R") => (
    <div className="flex min-h-56 w-40 flex-col items-center justify-center gap-3 rounded-2xl bg-leaf/30 p-3">
      {(["wolf", "goat", "cabbage"] as Thing[]).filter((t) => side[t] === s && boat !== t).map((t) => (
        <button key={t} disabled={side.you !== s || !!msg} onClick={() => setBoat(t)} className="tile px-4 py-2 text-5xl">{EMO[t]}</button>
      ))}
    </div>
  );
  return (
    <>
      <div className="flex items-stretch justify-center gap-2">
        {bank("L")}
        <div className={cn("flex flex-1 items-center rounded-2xl bg-sky/40 p-3", side.you === "L" ? "justify-start" : "justify-end")}>
          <div className="flex flex-col items-center rounded-2xl bg-card px-4 py-2 shadow">
            <span className="text-5xl">🚣{boat && <button onClick={() => setBoat(null)}>{EMO[boat]}</button>}</span>
            <span className="text-sm text-muted-foreground">{boat ? "tap to unload" : "tap an item to load"}</span>
          </div>
        </div>
        {bank("R")}
      </div>
      <p className="mt-3 text-center font-display text-xl">{msg || `Crossings: ${trips}`}</p>
      <div className="mt-3 flex justify-center gap-3">
        <Btn onClick={row} disabled={!!msg}>Row across ⛵</Btn>
        <Btn variant="ghost" onClick={reset}>Start over</Btn>
      </div>
    </>
  );
}

/* 27 — tiny sudoku */
export function P27({ report }: PuzzleProps) {
  const given = [[1, 0, 0, 4], [0, 4, 1, 0], [2, 0, 4, 0], [0, 3, 0, 1]];
  const sol = "1234341221434321";
  const [g, setG] = useState(given.map((r) => [...r]));
  const tap = (r: number, c: number) => setG((x) => x.map((row, i) => row.map((v, j) => (i === r && j === c ? (v + 1) % 5 : v))));
  return (
    <>
      <div className="mx-auto grid w-fit grid-cols-4 overflow-hidden rounded-xl border-8 border-ink">
        {g.map((row, r) => row.map((v, c) => (
          <button
            key={`${r}${c}`}
            disabled={given[r][c] !== 0}
            onClick={() => tap(r, c)}
            className={cn(
              "flex h-20 w-20 items-center justify-center border-ink/30 font-display text-4xl font-bold",
              c === 1 ? "border-r-8 border-r-ink" : "border-r-2",
              r === 1 ? "border-b-8 border-b-ink" : "border-b-2",
              given[r][c] ? "bg-muted text-foreground" : "bg-card text-primary",
            )}
          >
            {v || ""}
          </button>
        )))}
      </div>
      <p className="mt-2 text-center text-muted-foreground">Tap a white square to change its number.</p>
      <CheckBtn onCheck={() => report(g.flat().join("") === sol)} />
    </>
  );
}

/* 28 — lock */
export function P28({ report }: PuzzleProps) {
  const [d, setD] = useState([1, 1, 1, 1]);
  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <span className="text-7xl">🔒</span>
        <div className="flex gap-3 rounded-2xl bg-ink p-4">
          {d.map((v, i) => (
            <button key={i} onClick={() => setD((x) => x.map((y, j) => (j === i ? (y % 4) + 1 : y)))} className="flex h-24 w-20 items-center justify-center rounded-xl bg-card font-mono text-5xl font-bold active:scale-95">
              {v}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground">Tap a wheel to turn it.</p>
      </div>
      <CheckBtn onCheck={() => report(d.join("") === "2431")} />
    </>
  );
}

/* 29 — six coins on a triangle grid */
export function P29({ report }: PuzzleProps) {
  const pts: { r: number; i: number }[] = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) pts.push({ r, i });
  const [on, setOn] = useState<number[]>([]);
  const toggle = (k: number) => setOn((o) => (o.includes(k) ? o.filter((x) => x !== k) : o.length < 6 ? [...o, k] : o));
  const check = () => {
    if (on.length !== 6) return report(false);
    const P = on.map((k) => pts[k]);
    const col = (a: typeof P[0], b: typeof P[0], c: typeof P[0]) => (b.i - a.i) * (c.r - a.r) - (b.r - a.r) * (c.i - a.i) === 0;
    const lines = new Set<string>();
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
      const set = P.map((_, k) => k).filter((k) => col(P[a], P[b], P[k]));
      if (set.length === 3) lines.add(set.join());
    }
    report(lines.size >= 3);
  };
  return (
    <>
      <svg viewBox="-2.3 -0.6 4.6 3.8" className="mx-auto w-full max-w-md">
        {pts.map((p, k) => {
          const x = p.i - p.r / 2, y = p.r * 0.87;
          return on.includes(k) ? (
            <circle key={k} cx={x} cy={y} r="0.35" onClick={() => toggle(k)} className="fill-sun stroke-ink" strokeWidth="0.06" />
          ) : (
            <circle key={k} cx={x} cy={y} r="0.3" onClick={() => toggle(k)} className="fill-muted stroke-ink/30" strokeWidth="0.04" strokeDasharray="0.08 0.06" />
          );
        })}
      </svg>
      <p className="text-center font-display text-xl">Coins placed: {on.length} / 6</p>
      <CheckBtn onCheck={check} />
    </>
  );
}

/* 30 */
export const P30 = ({ report }: PuzzleProps) => (
  <div className="flex flex-col items-center gap-4">
    <div className="text-5xl">🧒🧒🧒🧒🧒🧒🧒🧒</div>
    <NumberAnswer correct={7} report={report} unit="matches" />
  </div>
);

/* 31 */
export function P31({ report }: PuzzleProps) {
  const [k, setK] = useState<Record<string, "truth" | "lie" | null>>({ A: null, B: null, C: null });
  const says: Record<string, string> = { A: "B always lies.", B: "C always lies.", C: "A and B are different kinds." };
  return (
    <>
      <div className="robot-truth-controls grid gap-4 md:grid-cols-3">
        {["A", "B", "C"].map((r) => (
          <div key={r} className="tile flex flex-col items-center gap-3 p-4">
            <span className="text-6xl">🤖</span>
            <span className="font-display text-2xl font-bold">Robot {r}</span>
            <span className="rounded-xl bg-muted px-3 py-2 text-center">“{says[r]}”</span>
            <div className="flex gap-2">
              {(["truth", "lie"] as const).map((t) => (
                <button key={t} onClick={() => setK((x) => ({ ...x, [r]: t }))} className={cn("tile px-3 py-2 font-display", k[r] === t && "tile-on")}>
                  {t === "truth" ? "Truth 😇" : "Liar 😈"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <CheckBtn onCheck={() => report(k.A === "truth" && k.B === "lie" && k.C === "truth")} />
    </>
  );
}

/* 32 — lantern bridge */
export function P32({ report }: PuzzleProps) {
  const people = [1, 2, 5, 10];
  const [right, setRight] = useState<number[]>([]);
  const [lantern, setLantern] = useState<"L" | "R">("L");
  const [sel, setSel] = useState<number[]>([]);
  const [time, setTime] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const sideOf = (p: number) => (right.includes(p) ? "R" : "L");
  const reset = () => { setRight([]); setLantern("L"); setSel([]); setTime(0); setLog([]); };
  const cross = () => {
    if (!sel.length) return;
    const t = Math.max(...sel);
    const nr = lantern === "L" ? [...right, ...sel] : right.filter((p) => !sel.includes(p));
    const nt = time + t;
    setRight(nr); setLantern(lantern === "L" ? "R" : "L"); setTime(nt); setSel([]);
    setLog((l) => [...l, `${sel.join(" & ")} ${lantern === "L" ? "→" : "←"} (${t} min)`]);
    if (nr.length === 4) report(nt <= 17);
  };
  const bank = (s: "L" | "R") => (
    <div className="flex min-h-56 w-44 flex-col items-center gap-2 rounded-2xl bg-leaf/30 p-3">
      {lantern === s && <span className="text-4xl">🏮</span>}
      {people.filter((p) => sideOf(p) === s).map((p) => (
        <button
          key={p}
          disabled={lantern !== s}
          onClick={() => setSel((x) => (x.includes(p) ? x.filter((y) => y !== p) : x.length < 2 ? [...x, p] : x))}
          className={cn("tile w-full px-3 py-2 font-display text-xl", sel.includes(p) && "tile-on")}
        >
          🚶 {p} min
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        {bank("L")}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-4 w-full rounded bg-accent-foreground/50" />
          <span className="font-display text-3xl font-bold">⏱ {time} min</span>
        </div>
        {bank("R")}
      </div>
      <div className="mt-3 flex justify-center gap-3">
        <Btn onClick={cross} disabled={!sel.length}>Cross the bridge</Btn>
        <Btn variant="ghost" onClick={reset}>Start over</Btn>
      </div>
      {log.length > 0 && <p className="mt-3 text-center text-muted-foreground">{log.join("  ·  ")}</p>}
    </>
  );
}

/* 33 */
export function P33({ report }: PuzzleProps) {
  const [n, setN] = useState([0, 0, 0, 0, 0]);
  return (
    <>
      <p className="mb-4 text-center font-display text-xl">How many coins will you take from each bag to weigh together?</p>
      <div className="coin-bag-controls flex flex-wrap justify-center gap-6">
        {n.map((v, i) => (
          <Stepper key={i} value={v} max={10} onChange={(x) => setN((s) => s.map((y, j) => (j === i ? x : y)))} label={<span className="text-5xl">💰<span className="block text-center font-display text-lg">Bag {i + 1}</span></span>} />
        ))}
      </div>
      <CheckBtn onCheck={() => report(new Set(n).size === 5)} />
    </>
  );
}

/* 34 */
export const P34 = ({ report }: PuzzleProps) => (
  <div className="flex flex-col items-center gap-6">
    <div className="grid grid-cols-4 overflow-hidden rounded-lg border-4 border-ink">
      {Array.from({ length: 16 }, (_, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        const x = i === 0 || i === 15;
        return <div key={i} className={cn("flex h-16 w-16 items-center justify-center text-3xl", x ? "bg-card text-destructive" : (r + c) % 2 ? "bg-card" : "bg-primary/60")}>{x ? "✗" : ""}</div>;
      })}
    </div>
    <div className="w-full max-w-md"><YesNo correct={false} report={report} /></div>
  </div>
);

/* 35 */
export const P35 = (p: PuzzleProps) => (
  <Machine {...p} start={1} cmds={[{ label: "DOUBLE", f: (n) => n * 2 }, { label: "ADD 1", f: (n) => n + 1 }]} done={(h) => h[h.length - 1] === 23 && h.length - 1 <= 7} />
);

/* 36 */
export function P36({ report }: PuzzleProps) {
  const [s, setS] = useState<boolean[][]>([Array(8).fill(false), Array(8).fill(false), Array(8).fill(false)]);
  return (
    <>
      <div className="space-y-4">
        {s.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 font-display text-xl font-bold">Scan {"ABC"[i]}</span>
            {row.map((on, j) => (
              <button key={j} onClick={() => setS((x) => x.map((r, a) => (a === i ? r.map((v, b) => (b === j ? !v : v)) : r)))} className={cn("tile flex h-16 flex-1 flex-col items-center justify-center", on && "tile-on")}>
                <span className="text-2xl">{on ? "🔍" : "🧰"}</span>
                <span className="text-sm font-bold">{j + 1}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-muted-foreground">Tap chests to add them to each scan group.</p>
      <CheckBtn onCheck={() => report(new Set(Array.from({ length: 8 }, (_, j) => s.map((r) => (r[j] ? 1 : 0)).join(""))).size === 8)} />
    </>
  );
}

/* 37 */
export const P37 = ({ report }: PuzzleProps) => (
  <SelectOne
    cols={2}
    correct="blue"
    report={report}
    options={[
      { id: "blue", label: "Blue", node: <span className="text-8xl">🧢</span> },
      { id: "red", label: "Red", node: <span className="text-8xl" style={{ filter: "hue-rotate(140deg)" }}>🧢</span> },
    ]}
  />
);

/* 38 — play the stone game */
export function P38({ report }: PuzzleProps) {
  const [left, setLeft] = useState(21);
  const [msg, setMsg] = useState("Your turn! Take 1, 2, or 3 stones.");
  const [over, setOver] = useState(false);
  const take = (k: number) => {
    const a = left - k;
    if (a === 0) { setLeft(0); setOver(true); setMsg("You took the last stone!"); report(true); return; }
    let c = a % 4 || 1 + Math.floor(Math.random() * Math.min(3, a));
    c = Math.min(c, a);
    const b = a - c;
    setLeft(b);
    if (b === 0) { setOver(true); setMsg(`Robot took ${c} — and the last stone. Try again!`); report(false); }
    else setMsg(`Robot took ${c}. Your turn!`);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className={cn("h-10 w-10 rounded-full border-4 border-ink/40 transition-all", i < left ? "bg-muted-foreground" : "scale-50 opacity-10")} />
        ))}
      </div>
      <p className="font-display text-2xl">{left} stones left · {msg}</p>
      <div className="flex gap-3">
        {[1, 2, 3].map((k) => <Btn key={k} disabled={over || k > left} onClick={() => take(k)}>Take {k}</Btn>)}
      </div>
      <Btn variant="ghost" onClick={() => { setLeft(21); setOver(false); setMsg("Your turn! Take 1, 2, or 3 stones."); }}>New game</Btn>
    </div>
  );
}

/* 39 */
export const P39 = ({ report }: PuzzleProps) => (
  <div className="flex flex-col items-center gap-6">
    <div className="text-6xl">🤖🤖🤖🤖🤖</div>
    <div className="w-full max-w-md"><YesNo correct={false} report={report} /></div>
  </div>
);

/* 40 */
export function P40({ report }: PuzzleProps) {
  const letters = ["S", "E", "N", "D", "M", "O", "R", "Y"];
  const [v, setV] = useState<Record<string, number | undefined>>({});
  const [act, setAct] = useState("S");
  const cell = (L: string) => (
    <button onClick={() => setAct(L)} className={cn("flex h-16 w-14 flex-col items-center justify-center rounded-lg border-4 bg-card", act === L ? "border-primary" : "border-ink/20")}>
      <span className="text-xs font-bold text-muted-foreground">{L}</span>
      <span className="font-display text-3xl font-bold">{v[L] ?? ""}</span>
    </button>
  );
  const sol: Record<string, number> = { S: 9, E: 5, N: 6, D: 7, M: 1, O: 0, R: 8, Y: 2 };
  return (
    <>
      <div className="mx-auto w-fit space-y-2 font-display">
        <div className="flex justify-end gap-2">{"SEND".split("").map((L, i) => <span key={i}>{cell(L)}</span>)}</div>
        <div className="flex items-center justify-end gap-2"><span className="text-4xl">+</span>{"MORE".split("").map((L, i) => <span key={i}>{cell(L)}</span>)}</div>
        <div className="flex justify-end gap-2 border-t-4 border-ink pt-2">{"MONEY".split("").map((L, i) => <span key={i}>{cell(L)}</span>)}</div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <span className="self-center font-display text-xl">{act} =</span>
        {Array.from({ length: 10 }, (_, d) => (
          <button key={d} onClick={() => { setV((x) => ({ ...x, [act]: d })); setAct(letters[(letters.indexOf(act) + 1) % 8]); }} className="tile h-14 w-14 font-display text-2xl font-bold">{d}</button>
        ))}
      </div>
      <CheckBtn onCheck={() => report(letters.every((L) => v[L] === sol[L]))} />
    </>
  );
}
