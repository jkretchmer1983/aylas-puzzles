import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Report = (ok: boolean) => void;
export type PuzzleProps = { report: Report };

/* ---------- Buttons ---------- */
export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "sun" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const v = {
    primary: "bg-primary text-primary-foreground border-ink/30",
    soft: "bg-secondary text-secondary-foreground border-primary/30",
    sun: "bg-accent text-accent-foreground border-ink/20",
    ghost: "bg-card text-foreground border-border",
  }[variant];
  return (
    <button disabled={disabled} onClick={onClick} className={cn("chunky px-6 py-3", v, className)}>
      {children}
    </button>
  );
}

export function CheckBtn({ onCheck }: { onCheck: () => void }) {
  return (
    <div className="mt-6 flex justify-center">
      <Btn variant="sun" onClick={onCheck} className="px-10 text-2xl">
        Check my answer ✓
      </Btn>
    </div>
  );
}

/* ---------- Shapes ---------- */
export type ShapeKind = "circle" | "square" | "triangle" | "star";
export function Shape({ kind, size = 64, className }: { kind: ShapeKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      {kind === "circle" && <circle cx="50" cy="50" r="40" className="fill-sky stroke-ink" strokeWidth="5" />}
      {kind === "square" && <rect x="12" y="12" width="76" height="76" className="fill-berry stroke-ink" strokeWidth="5" />}
      {kind === "triangle" && <polygon points="50,10 92,88 8,88" className="fill-leaf stroke-ink" strokeWidth="5" strokeLinejoin="round" />}
      {kind === "star" && (
        <polygon
          points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38"
          className="fill-sun stroke-ink"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/* ---------- Select one (tap = answer) ---------- */
const colClass = (cols: number) =>
  ({
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-6",
  }[cols] ?? null);

export function SelectOne({
  options,
  correct,
  report,
  cols = 3,
}: {
  options: { id: string; node: ReactNode; label?: string }[];
  correct: string;
  report: Report;
  cols?: number;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const c = colClass(cols);
  return (
    <div
      className={cn("grid gap-3 sm:gap-4", c)}
      style={c ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => {
            setSel(o.id);
            report(o.id === correct);
          }}
          className={cn(
            "tile flex min-h-32 flex-col items-center justify-center gap-2 p-3 sm:p-4",
            sel === o.id && "tile-on rounded-[3rem]",
          )}
        >
          {o.node}
          {o.label && <span className="font-display text-xl font-semibold">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Select many ---------- */
export function SelectMany({
  options,
  correct,
  report,
  cols = 3,
}: {
  options: { id: string; node: ReactNode; label?: string }[];
  correct: string[];
  report: Report;
  cols?: number;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const c = colClass(cols);
  return (
    <>
      <div
        className={cn("grid gap-3 sm:gap-4", c)}
        style={c ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => toggle(o.id)}
            className={cn("tile flex min-h-28 flex-col items-center justify-center gap-2 p-3 sm:p-4", sel.includes(o.id) && "tile-on rounded-[3rem]")}
          >
            {o.node}
            {o.label && <span className="font-display text-lg font-semibold">{o.label}</span>}
          </button>
        ))}
      </div>
      <CheckBtn
        onCheck={() => report(sel.length === correct.length && correct.every((c) => sel.includes(c)))}
      />
    </>
  );
}

/* ---------- Drag (or tap) items into slots ---------- */
export type Item = { id: string; label: string; emoji?: string };
export function SlotAssign({
  items,
  slots,
  answer,
  report,
  grid,
  slotClass,
}: {
  items: Item[];
  slots: { id: string; label: string }[];
  answer: Record<string, string> | ((a: Record<string, string>) => boolean);
  report: Report;
  grid?: number;
  slotClass?: string;
}) {
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const start = useRef({ x: 0, y: 0 });

  const placed = Object.values(assign);
  const pool = items.filter((i) => !placed.includes(i.id));
  const byId = (id: string) => items.find((i) => i.id === id)!;

  const place = (slot: string, item: string) =>
    setAssign((a) => {
      const n: Record<string, string> = {};
      for (const [k, v] of Object.entries(a)) if (v !== item) n[k] = v;
      n[slot] = item;
      return n;
    });

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const moved = drag.moved || Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved } : d));
    };
    const up = (e: PointerEvent) => {
      if (drag.moved) {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot]") as HTMLElement | null;
        if (el?.dataset.slot) {
          place(el.dataset.slot, drag.id);
          setSel(null);
        } else if (el === null) {
          const poolEl = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pool]");
          if (poolEl) setAssign((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== drag.id)));
        }
      }
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag]);

  const token = (it: Item) => (
    <div
      key={it.id}
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { x: e.clientX, y: e.clientY };
        setSel((s) => (s === it.id ? null : it.id));
        setDrag({ id: it.id, x: e.clientX, y: e.clientY, moved: false });
      }}
      className={cn(
        "tile flex cursor-grab touch-none items-center gap-2 px-4 py-3 font-display text-xl font-semibold",
        sel === it.id && "tile-on",
        drag?.id === it.id && drag.moved && "opacity-30",
      )}
    >
      {it.emoji && <span className="text-4xl">{it.emoji}</span>}
      {it.label}
    </div>
  );

  return (
    <>
      <div data-pool className="mb-6 flex min-h-20 flex-wrap justify-center gap-3 rounded-2xl border-4 border-dashed border-border p-3">
        {pool.length ? pool.map(token) : <span className="self-center text-muted-foreground">All placed!</span>}
      </div>
      <div className={cn("grid gap-3", grid ? "" : "grid-cols-1")} style={grid ? { gridTemplateColumns: `repeat(${grid}, minmax(0,1fr))` } : undefined}>
        {slots.map((s) => {
          const it = assign[s.id];
          return (
            <div
              key={s.id}
              data-slot={s.id}
              onClick={() => {
                if (sel) {
                  place(s.id, sel);
                  setSel(null);
                } else if (it) setAssign((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== s.id)));
              }}
              className={cn(
                "flex min-h-24 items-center gap-4 rounded-2xl border-4 border-primary/40 bg-secondary/60 p-3",
                sel && "border-primary",
                slotClass,
              )}
            >
              <span className="w-28 shrink-0 font-display text-lg font-bold uppercase text-primary">{s.label}</span>
              {it && <div className="pointer-events-none">{token(byId(it))}</div>}
            </div>
          );
        })}
      </div>
      {drag?.moved && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2" style={{ left: drag.x, top: drag.y }}>
          <div className="tile tile-on flex items-center gap-2 px-4 py-3 font-display text-xl font-semibold shadow-xl">
            {byId(drag.id).emoji && <span className="text-4xl">{byId(drag.id).emoji}</span>}
            {byId(drag.id).label}
          </div>
        </div>
      )}
      <CheckBtn
        onCheck={() =>
          report(
            typeof answer === "function"
              ? answer(assign)
              : Object.keys(answer).every((k) => assign[k] === answer[k]),
          )
        }
      />
    </>
  );
}

/* ---------- Number answer keypad ---------- */
export function NumberAnswer({ correct, report, unit }: { correct: number; report: Report; unit?: string }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-baseline gap-3">
        <div className="flex h-24 min-w-32 items-center justify-center rounded-2xl border-4 border-primary bg-card px-6 font-display text-6xl font-bold">
          {v || "?"}
        </div>
        {unit && <span className="font-display text-2xl">{unit}</span>}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button key={n} onClick={() => setV((x) => (x + n).slice(-3))} className="tile h-16 w-16 font-display text-3xl font-bold">
            {n}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Btn variant="ghost" onClick={() => setV("")}>Clear</Btn>
        <Btn variant="sun" onClick={() => report(Number(v) === correct && v !== "")}>Check ✓</Btn>
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 99, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; label?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label}
      <div className="flex items-center gap-2">
        <button className="tile h-14 w-14 font-display text-3xl" onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <span className="w-14 text-center font-display text-4xl font-bold">{value}</span>
        <button className="tile h-14 w-14 font-display text-3xl" onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

export function YesNo({ correct, report }: { correct: boolean; report: Report }) {
  return (
    <SelectOne
      cols={2}
      correct={correct ? "yes" : "no"}
      report={report}
      options={[
        { id: "yes", node: <span className="text-6xl">👍</span>, label: "Yes" },
        { id: "no", node: <span className="text-6xl">👎</span>, label: "No" },
      ]}
    />
  );
}
