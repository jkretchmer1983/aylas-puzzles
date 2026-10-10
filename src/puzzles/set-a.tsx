import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Btn, CheckBtn, NumberAnswer, SelectMany, SelectOne, Shape, SlotAssign, Stepper,
  type PuzzleProps, type ShapeKind,
} from "./kit";

/* 1 */
export function P1({ report }: PuzzleProps) {
  const kinds: ShapeKind[] = ["triangle", "circle", "square", "star"];
  return (
    <SelectOne
      cols={4}
      correct="circle"
      report={report}
      options={kinds.map((k, i) => ({
        id: k,
        label: `Door ${i + 1}`,
        node: (
          <div className="flex h-40 w-full max-w-24 items-start justify-center rounded-t-[3rem] border-4 border-ink bg-accent/60 pt-4">
            <Shape kind={k} size={52} />
          </div>
        ),
      }))}
    />
  );
}

/* 2 — draw lines between matching socks */
type Pat = "lines" | "dots" | "zig";
function Sock({ pat }: { pat: Pat }) {
  return (
    <svg width="80" height="100" viewBox="0 0 80 100">
      <path d="M20 5 h35 v55 q0 10 -10 18 l-12 12 q-12 10 -24 -2 q-8 -10 2 -20 l9 -9 z" className="fill-paper stroke-ink" strokeWidth="4" />
      {pat === "lines" && [20, 32, 44].map((y) => <line key={y} x1="20" x2="55" y1={y} y2={y} className="stroke-berry" strokeWidth="5" />)}
      {pat === "dots" && [[30, 22], [45, 22], [30, 40], [45, 40]].map(([x, y]) => <circle key={x + "" + y} cx={x} cy={y} r="5" className="fill-sky" />)}
      {pat === "zig" && [22, 42].map((y) => <polyline key={y} points={`20,${y} 29,${y - 7} 37,${y} 46,${y - 7} 55,${y}`} className="fill-none stroke-leaf" strokeWidth="5" />)}
    </svg>
  );
}
export function P2({ report }: PuzzleProps) {
  const socks: { id: string; pat: Pat; row: 0 | 1 }[] = [
    { id: "t0", pat: "lines", row: 0 }, { id: "t1", pat: "dots", row: 0 }, { id: "t2", pat: "zig", row: 0 },
    { id: "b0", pat: "zig", row: 1 }, { id: "b1", pat: "lines", row: 1 }, { id: "b2", pat: "dots", row: 1 },
  ];
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [centers, setCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [live, setLive] = useState<{ from: string; x: number; y: number } | null>(null);

  const measure = () => {
    const b = box.current?.getBoundingClientRect();
    if (!b) return;
    const c: Record<string, { x: number; y: number }> = {};
    for (const s of socks) {
      const r = refs.current[s.id]?.getBoundingClientRect();
      if (r) c[s.id] = { x: r.left + r.width / 2 - b.left, y: (s.row === 0 ? r.bottom : r.top) - b.top };
    }
    setCenters(c);
  };
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const local = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const end = (e: React.PointerEvent) => {
    if (!live) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-sock]") as HTMLElement | null;
    const to = el?.dataset.sock;
    if (to && to !== live.from) {
      setPairs((p) => [...p.filter((x) => !x.includes(live.from) && !x.includes(to)), [live.from, to]]);
    }
    setLive(null);
  };

  const pat = (id: string) => socks.find((s) => s.id === id)!;
  return (
    <>
      <div
        ref={box}
        className="relative touch-none select-none"
        onPointerMove={(e) => live && setLive({ ...live, ...local(e) })}
        onPointerUp={end}
      >
        {[0, 1].map((row) => (
          <div key={row} className={cn("flex justify-around", row === 1 && "mt-40")}>
            {socks.filter((s) => s.row === row).map((s) => (
              <div
                key={s.id}
                data-sock={s.id}
                ref={(el) => { refs.current[s.id] = el; }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as Element).releasePointerCapture?.(e.pointerId);
                  setLive({ from: s.id, ...local(e) });
                }}
                className={cn("tile p-3", live?.from === s.id && "tile-on")}
              >
                <Sock pat={s.pat} />
              </div>
            ))}
          </div>
        ))}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {pairs.map(([a, b]) => centers[a] && centers[b] && (
            <line key={a + b} x1={centers[a].x} y1={centers[a].y} x2={centers[b].x} y2={centers[b].y} className="stroke-primary" strokeWidth="8" strokeLinecap="round" />
          ))}
          {live && centers[live.from] && (
            <line x1={centers[live.from].x} y1={centers[live.from].y} x2={live.x} y2={live.y} className="stroke-accent" strokeWidth="8" strokeLinecap="round" strokeDasharray="4 12" />
          )}
        </svg>
      </div>
      <p className="mt-4 text-center text-muted-foreground">Press on a sock and drag to its partner.</p>
      <div className="mt-2 flex justify-center"><Btn variant="ghost" onClick={() => setPairs([])}>Erase lines</Btn></div>
      <CheckBtn
        onCheck={() =>
          report(pairs.length === 3 && pairs.every(([a, b]) => pat(a).pat === pat(b).pat && pat(a).row !== pat(b).row))
        }
      />
    </>
  );
}

/* 3 */
export function P3({ report }: PuzzleProps) {
  const [pick, setPick] = useState<ShapeKind | null>(null);
  const train: ShapeKind[] = ["star", "circle", "star", "circle", "star"];
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-wrap items-end justify-center gap-2">
        <span className="text-6xl">🚂</span>
        {[...train, pick].map((k, i) => (
          <div key={i} className={cn("flex h-24 w-24 items-center justify-center rounded-xl border-4 border-ink bg-card", i === 5 && "border-dashed bg-secondary")}>
            {k ? <Shape kind={k} size={60} className={i === 5 ? "animate-pop" : ""} /> : <span className="font-display text-4xl text-primary">?</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        {(["circle", "triangle", "star"] as ShapeKind[]).map((k) => (
          <button key={k} className={cn("tile p-4", pick === k && "tile-on")} onClick={() => { setPick(k); report(k === "circle"); }}>
            <Shape kind={k} size={70} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* 4 */
export function P4({ report }: PuzzleProps) {
  const list: [ShapeKind, number][] = [["circle", 90], ["square", 60], ["triangle", 70], ["star", 70], ["triangle", 50], ["circle", 50]];
  return (
    <SelectMany
      correct={["0", "5"]}
      report={report}
      options={list.map(([k, s], i) => ({ id: String(i), node: <Shape kind={k} size={s} /> }))}
    />
  );
}

/* 5 */
export function P5({ report }: PuzzleProps) {
  return (
    <SelectOne
      correct="mid"
      report={report}
      options={[
        { id: "big", node: <span style={{ fontSize: 110 }}>🐻</span> },
        { id: "small", node: <span style={{ fontSize: 48 }}>🐻</span> },
        { id: "mid", node: <span style={{ fontSize: 78 }}>🐻</span> },
      ]}
    />
  );
}

/* 6 */
export function P6({ report }: PuzzleProps) {
  return (
    <SlotAssign
      report={report}
      items={[{ id: "dog", label: "Dog", emoji: "🐶" }, { id: "cat", label: "Cat", emoji: "🐱" }, { id: "bird", label: "Bird", emoji: "🐦" }]}
      slots={[{ id: "top", label: "Top" }, { id: "mid", label: "Middle" }, { id: "bot", label: "Bottom" }]}
      answer={{ top: "bird", mid: "cat", bot: "dog" }}
    />
  );
}

/* 7 */
export function P7({ report }: PuzzleProps) {
  return (
    <SlotAssign
      report={report}
      items={[{ id: "duck", label: "Duck", emoji: "🦆" }, { id: "teddy", label: "Teddy", emoji: "🧸" }, { id: "rabbit", label: "Rabbit", emoji: "🐰" }]}
      slots={[{ id: "1", label: "First" }, { id: "2", label: "Second" }, { id: "3", label: "Third" }]}
      answer={{ 1: "teddy", 2: "rabbit", 3: "duck" }}
    />
  );
}

/* 8 */
export function P8({ report }: PuzzleProps) {
  return (
    <SelectOne
      correct="rabbit"
      report={report}
      options={[
        { id: "mouse", node: <span className="text-8xl">🐭</span>, label: "Mouse" },
        { id: "rabbit", node: <span className="text-8xl">🐰</span>, label: "Rabbit" },
        { id: "bear", node: <span className="text-8xl">🐻</span>, label: "Bear" },
      ]}
    />
  );
}

/* 9 & 18 — jumping */
export function Jumps({ report, max, allowed, count, labels }: PuzzleProps & { max: number; allowed: number[]; count: number; labels?: (n: number) => string }) {
  const [path, setPath] = useState<number[]>([0]);
  const pos = path[path.length - 1];
  const W = 100 / (max + 1);
  return (
    <>
      <div className="relative">
        <svg viewBox="0 0 100 22" className="h-24 w-full">
          {path.slice(1).map((p, i) => {
            const a = (path[i] + 0.5) * W, b = (p + 0.5) * W;
            return <path key={i} d={`M${a} 20 Q${(a + b) / 2} ${2} ${b} 20`} className="fill-none stroke-primary" strokeWidth="1.2" strokeDasharray="2 1.5" />;
          })}
        </svg>
        <div className="flex">
          {Array.from({ length: max + 1 }, (_, n) => {
            const ok = allowed.includes(n - pos);
            return (
              <button
                key={n}
                onClick={() => ok && setPath((p) => [...p, n])}
                className={cn(
                  "relative mx-0.5 flex h-20 flex-1 items-center justify-center rounded-full border-4 font-display text-2xl font-bold",
                  n === 0 ? "border-leaf bg-leaf/30" : "border-ink/40 bg-muted",
                  ok && "border-primary bg-secondary",
                )}
              >
                {n === pos ? <span className="text-4xl">🐸</span> : labels ? labels(n) : n}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 font-display text-xl">
        Jumps: {path.length - 1 ? path.slice(1).map((p, i) => p - path[i]).join(" + ") : "none yet"}
        <Btn variant="ghost" onClick={() => setPath([0])}>Start over</Btn>
      </div>
      <CheckBtn onCheck={() => report(pos === max && path.length - 1 === count)} />
    </>
  );
}
export const P9 = (p: PuzzleProps) => <Jumps {...p} max={4} allowed={[1, 2]} count={3} labels={(n) => (n === 0 ? "Bank" : String(n))} />;

/* 10 */
export function P10({ report }: PuzzleProps) {
  return (
    <SelectOne
      correct="block"
      report={report}
      options={[
        { id: "spoon", node: <span className="text-8xl">🥄</span>, label: "Spoon" },
        { id: "car", node: <span className="text-8xl">🚗</span>, label: "Toy car" },
        { id: "block", node: <span className="text-8xl">🧱</span>, label: "Block" },
      ]}
    />
  );
}

/* 11 */
export function P11({ report }: PuzzleProps) {
  return (
    <SlotAssign
      report={report}
      items={[{ id: "apple", label: "Apple", emoji: "🍎" }, { id: "banana", label: "Banana", emoji: "🍌" }, { id: "pear", label: "Pear", emoji: "🍐" }]}
      slots={[{ id: "ari", label: "Ari" }, { id: "bo", label: "Bo" }, { id: "cy", label: "Cy" }]}
      answer={{ ari: "pear", bo: "apple", cy: "banana" }}
    />
  );
}

/* 12 — tap to add spots */
function Bug({ spots, size = 90, onTap }: { spots: [number, number][]; size?: number; onTap?: (x: number, y: number) => void }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onPointerDown={(e) => {
        if (!onTap) return;
        const r = (e.currentTarget as SVGElement).getBoundingClientRect();
        onTap(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      }}
      className={onTap ? "cursor-pointer touch-none" : ""}
    >
      <circle cx="50" cy="18" r="13" className="fill-ink" />
      <ellipse cx="50" cy="58" rx="38" ry="36" className="fill-berry stroke-ink" strokeWidth="4" />
      <line x1="50" y1="24" x2="50" y2="94" className="stroke-ink" strokeWidth="3" />
      {spots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" className="fill-ink" />)}
    </svg>
  );
}
export function P12({ report }: PuzzleProps) {
  const [spots, setSpots] = useState<[number, number][]>([]);
  const pre: [number, number][][] = [
    [[35, 55]],
    [[35, 45], [65, 55], [35, 72]],
    [[33, 42], [67, 42], [50, 60], [33, 76], [67, 76]],
  ];
  return (
    <>
      <div className="flex flex-wrap items-end justify-center gap-6">
        {pre.map((s, i) => (
          <div key={i} className="flex flex-col items-center"><Bug spots={s} /><span className="font-display text-3xl font-bold">{s.length}</span></div>
        ))}
        <div className="flex flex-col items-center">
          <div className="rounded-full ring-4 ring-primary ring-offset-4 ring-offset-card">
            <Bug size={200} spots={spots} onTap={(x, y) => setSpots((s) => [...s, [x, y]])} />
          </div>
          <span className="mt-2 font-display text-3xl font-bold">{spots.length || "?"}</span>
        </div>
      </div>
      <p className="mt-2 text-center text-muted-foreground">Tap the big ladybug to add spots.</p>
      <div className="mt-2 flex justify-center gap-3">
        <Btn variant="ghost" onClick={() => setSpots((s) => s.slice(0, -1))}>Undo</Btn>
        <Btn variant="ghost" onClick={() => setSpots([])}>Clear</Btn>
      </div>
      <CheckBtn onCheck={() => report(spots.length === 7)} />
    </>
  );
}

/* 13 — draw a route on a grid */
export function P13({ report }: PuzzleProps) {
  const [path, setPath] = useState<[number, number][]>([[0, 0]]);
  const last = path[path.length - 1];
  const P = (x: number, y: number) => ({ cx: 20 + x * 80, cy: 180 - y * 80 });
  const tap = (x: number, y: number) => {
    if (path.length > 1 && x === last[0] && y === last[1]) return setPath((p) => p.slice(0, -1));
    const dx = x - last[0], dy = y - last[1];
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) setPath((p) => [...p, [x, y]]);
  };
  return (
    <>
      <svg viewBox="-40 -25 310 245" className="mx-auto w-full max-w-lg touch-none">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line x1="20" x2="180" y1={20 + i * 80} y2={20 + i * 80} className="stroke-ink/40" strokeWidth="3" />
            <line y1="20" y2="180" x1={20 + i * 80} x2={20 + i * 80} className="stroke-ink/40" strokeWidth="3" />
          </g>
        ))}
        <polyline points={path.map(([x, y]) => `${P(x, y).cx},${P(x, y).cy}`).join(" ")} className="fill-none stroke-primary" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        {[0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => {
          const { cx, cy } = P(x, y);
          if (x === 1 && y === 1)
            return <text key="t" x={cx} y={cy + 14} fontSize="44" textAnchor="middle" onClick={() => tap(1, 1)}>🌳</text>;
          const on = path.some(([a, b]) => a === x && b === y);
          return <circle key={`${x}${y}`} cx={cx} cy={cy} r="16" onClick={() => tap(x, y)} className={on ? "fill-primary" : "fill-ink"} />;
        }))}
        <text x="20" y="218" fontSize="15" textAnchor="middle" className="fill-ink font-display font-bold">START</text>
        <text x="232" y="25" fontSize="15" textAnchor="middle" className="fill-ink font-display font-bold">🏠 HOME</text>
      </svg>
      <p className="text-center text-muted-foreground">Tap the next dot to draw your route. Tap the last dot to undo.</p>
      <div className="mt-2 flex justify-center"><Btn variant="ghost" onClick={() => setPath([[0, 0]])}>Start over</Btn></div>
      <CheckBtn onCheck={() => report(path.length === 5 && last[0] === 2 && last[1] === 2 && !path.some(([x, y]) => x === 1 && y === 1))} />
    </>
  );
}

/* 14 */
export function P14({ report }: PuzzleProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-8 font-display text-3xl">
        <div className="tile px-6 py-4">🍎 = 🧱🧱</div>
        <div className="tile px-6 py-4">🍐 = 🍎 + 🧱</div>
      </div>
      <div className="font-display text-3xl">🍐 = how many 🧱?</div>
      <NumberAnswer correct={3} report={report} unit="blocks" />
    </div>
  );
}

/* 15 */
export function P15({ report }: PuzzleProps) {
  return (
    <SlotAssign
      report={report}
      grid={2}
      items={[{ id: "turtle", label: "Turtle", emoji: "🐢" }, { id: "fox", label: "Fox", emoji: "🦊" }, { id: "dog", label: "Dog", emoji: "🐶" }, { id: "rabbit", label: "Rabbit", emoji: "🐰" }]}
      slots={[{ id: "1", label: "1st" }, { id: "2", label: "2nd" }, { id: "3", label: "3rd" }, { id: "4", label: "4th" }]}
      answer={{ 1: "dog", 2: "rabbit", 3: "fox", 4: "turtle" }}
    />
  );
}

/* 16 */
export function P16({ report }: PuzzleProps) {
  const [sel, setSel] = useState<number | null>(null);
  const icon: Record<number, string> = { 1: "⛵", 6: "🐚" };
  return (
    <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl border-4 border-ink bg-accent/40 p-2">
      {Array.from({ length: 9 }, (_, i) => (
        <button
          key={i}
          onClick={() => { setSel(i); report(i === 5); }}
          className="flex aspect-square items-center justify-center rounded-xl border-4 border-ink/20 bg-card text-6xl active:scale-95"
        >
          {sel === i ? <span className="animate-pop font-display font-bold text-destructive">✕</span> : icon[i] ?? ""}
        </button>
      ))}
    </div>
  );
}

/* 17 */
export function P17({ report }: PuzzleProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="space-y-2 font-display text-4xl">
        <div>⭐ + ⭐ = 8</div>
        <div>⭐ + 🌙 = 7</div>
        <div className="text-primary">⭐ + 🌙 + 🌙 = ?</div>
      </div>
      <NumberAnswer correct={10} report={report} />
    </div>
  );
}

/* 18 */
export const P18 = (p: PuzzleProps) => <Jumps {...p} max={10} allowed={[2, 3]} count={4} />;

/* 19 */
export function P19({ report }: PuzzleProps) {
  const [v, setV] = useState([0, 0, 0]);
  const total = v.reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="flex flex-wrap justify-center gap-8">
        {v.map((n, i) => (
          <Stepper
            key={i}
            value={n}
            step={2}
            max={14}
            onChange={(x) => setV((s) => s.map((y, j) => (j === i ? x : y)))}
            label={
              <div className="flex h-28 w-28 flex-wrap content-center items-center justify-center gap-1 rounded-full border-4 border-dashed border-primary p-3">
                {Array.from({ length: n }, (_, k) => <span key={k} className="h-3 w-3 rounded-full bg-berry" />)}
              </div>
            }
          />
        ))}
      </div>
      <p className={cn("mt-4 text-center font-display text-2xl", total === 14 ? "text-success" : "text-muted-foreground")}>
        Beads used: {total} / 14
      </p>
      <CheckBtn onCheck={() => report([...v].sort((a, b) => a - b).join() === "2,4,8")} />
    </>
  );
}

/* 20 */
export function P20({ report }: PuzzleProps) {
  return (
    <SlotAssign
      report={report}
      grid={2}
      slotClass="min-h-32 flex-col justify-center"
      items={[{ id: "cat", label: "Cat", emoji: "🐱" }, { id: "dog", label: "Dog", emoji: "🐶" }, { id: "bird", label: "Bird", emoji: "🐦" }, { id: "rabbit", label: "Rabbit", emoji: "🐰" }]}
      slots={[{ id: "tl", label: "Top left" }, { id: "tr", label: "Top right" }, { id: "bl", label: "Bottom left" }, { id: "br", label: "Bottom right" }]}
      answer={{ tl: "bird", tr: "cat", bl: "rabbit", br: "dog" }}
    />
  );
}
