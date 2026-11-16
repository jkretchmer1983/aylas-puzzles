import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PuzzleSpec } from "../types";
import "./pattern-loom.css";
import { Embroidery } from "./LoomArt";
import { fitLoomPlane, LANDSCAPE_CLOTH, PORTRAIT_CLOTH, type LoomFit } from "./loom-fit";

export type LoomState = { placed: number | null; result: "ready" | "wrong" | "correct" };
export const patchOverPocket = (
  x: number,
  y: number,
  r: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
) => x >= r.left - 26 && x <= r.right + 26 && y >= r.top - 26 && y <= r.bottom + 26;

export function PatternLoom({
  spec,
  check,
  saved,
  save,
  sound = false,
}: {
  sound?: boolean | undefined;
  spec: PuzzleSpec;
  check: (index: number) => boolean;
  saved?: LoomState | undefined;
  save?: ((state: LoomState) => void) | undefined;
}) {
  const options = spec.kind.type === "choice" ? spec.kind.options : [];
  const sequence = spec.visual?.type === "rows" ? spec.visual.rows.flat().slice(0, -1) : [];
  const [placed, setPlaced] = useState<number | null>(saved?.placed ?? null);
  const [result, setResult] = useState<LoomState["result"]>(saved?.result ?? "ready");
  const [picked, setPicked] = useState<number | null>(null);
  const [carry, setCarry] = useState<{
    index: number;
    x: number;
    y: number;
    returning?: boolean;
  } | null>(null);
  const [over, setOver] = useState(false);
  const [weaving, setWeaving] = useState(false);
  const pocket = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<LoomFit & { cols: number }>({
    patch: 50,
    rows: Math.ceil((sequence.length + 1) / 3),
    cols: 3,
    perspective: 450,
    plane: { left: 0, top: 0, width: 0, height: 0 },
    scrolls: false,
  });
  const rail = useRef<HTMLDivElement>(null);
  const pegs = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<{
    index: number;
    x: number;
    y: number;
    lifted: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audio = useRef<AudioContext[]>([]);
  const suppressClick = useRef(false);
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const wide = window.matchMedia("(orientation: landscape) and (min-width: 700px)").matches;
      const stage = el.closest(".pattern-screen") ?? document.documentElement;
      const img = stage.querySelector<HTMLImageElement>(".loom-world img");
      const art = wide ? LANDSCAPE_CLOTH : PORTRAIT_CLOTH;
      const s = stage.getBoundingClientRect();
      const z = el.getBoundingClientRect();
      // The CSS frame is the zone left free by title, footer and hanging choices;
      // the painted cloth inside it decides where the block actually sits.
      const count = sequence.length + 1;
      const fitFor = (cols: number) => fitLoomPlane({
        stageW: s.width,
        stageH: s.height,
        art,
        naturalW: img?.naturalWidth || art.w,
        naturalH: img?.naturalHeight || art.h,
        zone: { left: z.left - s.left, top: z.top - s.top, right: z.right - s.left, bottom: z.bottom - s.top },
        cols,
        count,
      });
      let cols = wide ? 5 : 3;
      let next = fitFor(cols);
      // Short landscapes show little cloth: widen the rows rather than hide the pocket.
      for (let c = cols + 1; wide && next.scrolls && c <= Math.min(count, 9); c++) {
        const wider = fitFor(c);
        if (wider.plane.width <= z.width && !wider.scrolls) { cols = c; next = wider; break; }
      }
      const plane = {
        left: Math.round(next.plane.left - (z.left - s.left)),
        top: Math.round(next.plane.top - (z.top - s.top)),
        width: Math.round(next.plane.width),
        height: Math.round(next.plane.height),
      };
      setFit(old =>
        old.patch === next.patch && old.rows === next.rows && old.cols === cols &&
        old.perspective === next.perspective && old.plane.left === plane.left &&
        old.plane.top === plane.top && old.plane.width === plane.width && old.plane.height === plane.height
          ? old
          : { ...next, cols, plane },
      );
    };
    let pending = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(el);
    window.addEventListener("resize", scheduleMeasure);
    const img = el.closest(".pattern-screen")?.querySelector(".loom-world img");
    img?.addEventListener("load", scheduleMeasure);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      window.removeEventListener("resize", scheduleMeasure);
      img?.removeEventListener("load", scheduleMeasure);
    };
  }, [sequence.length]);

  useEffect(
    () => () => {
      if (gesture.current) clearTimeout(gesture.current.timer);
      timers.current.forEach(clearTimeout);
      audio.current.forEach(ctx => { void ctx.close().catch(() => {}); });
    },
    [],
  );
  useEffect(() => {
    save?.({ placed, result });
  }, [placed, result, save]);
  useEffect(() => {
    const cancel = () => {
      if (gesture.current) clearTimeout(gesture.current.timer);
      gesture.current = null;
      setCarry(null);
      setOver(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancel();
        setPicked(null);
      }
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("resize", cancel);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  const chime = (success: boolean) => {
    if (!sound) return;
    try {
      const ctx = new AudioContext();
      audio.current.push(ctx);
      [0, 0.11, 0.22].slice(0, success ? 3 : 1).forEach((delay, i) => {
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = success ? ([523, 659, 784][i] ?? 523) : 220;
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + 0.22);
      });
      timers.current.push(
        setTimeout(() => {
          void ctx.close();
        }, 650),
      );
    } catch {
      /* Audio may be unavailable; gameplay remains usable. */
    }
  };
  const place = (index: number) => {
    if (result === "correct") return;
    setPlaced(index);
    setPicked(null);
    setResult("ready");
  };
  const move = (x: number, y: number) => {
    const g = gesture.current;
    if (!g?.lifted) return;
    // Visible patch center, always 52px above the finger, is the hit-test point.
    const cy = y - 52;
    setCarry({ index: g.index, x, y: cy });
    const r = pocket.current?.getBoundingClientRect();
    setOver(!!r && patchOverPocket(x, cy, r));
    const band = rail.current?.getBoundingClientRect();
    if (band && y > band.top && y < band.bottom)
      rail.current?.scrollBy({ left: x > band.right - 45 ? 25 : x < band.left + 45 ? -25 : 0 });
  };
  const finish = (x: number, y: number, cancelled = false) => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.timer);
    gesture.current = null;
    if (!g.lifted) return;
    suppressClick.current = true;
    const r = pocket.current?.getBoundingClientRect();
    if (!cancelled && r && patchOverPocket(x, y - 52, r)) {
      place(g.index);
      setCarry(null);
    } else {
      const peg = pegs.current[g.index]?.getBoundingClientRect();
      if (peg)
        setCarry({
          index: g.index,
          x: peg.left + peg.width / 2,
          y: peg.top + peg.height / 2,
          returning: true,
        });
      timers.current.push(setTimeout(() => setCarry(null), 230));
    }
    setOver(false);
    timers.current.push(
      setTimeout(() => {
        suppressClick.current = false;
      }, 0),
    );
  };
  return (
    <section
      className={`pattern-loom ${weaving ? "loom-weaving" : ""} ${result === "correct" ? "loom-solved" : ""}`}
      style={
        {
          "--patch-size": `${fit.patch}px`,
          "--loom-active-rows": fit.rows,
          "--loom-cols": fit.cols,
          "--loom-rows": Math.ceil((sequence.length + 1) / 3),
          "--loom-wide-rows": Math.ceil((sequence.length + 1) / 5),
        } as CSSProperties
      }
      aria-label="Interactive pattern loom"
    >
      <p className="loom-direction">
        Start at 1 · read across → <span>Then follow the next numbered row ↓</span>
      </p>
      <div className="loom-workspace">
        <div className="loom-frame" ref={frame}>
          <div className="loom-warp" aria-hidden="true" />
          <div
            className="loom-plane"
            style={{
              left: fit.plane.left,
              top: fit.plane.top,
              width: fit.plane.width,
              height: fit.plane.height,
              perspective: `${fit.perspective}px`,
            }}
          >
          <div
            className="loom-rail"
            ref={rail}
            tabIndex={0}
            role="region"
            aria-label="Pattern cloth, numbered rows read left to right"
          >
            <ol className="loom-cloth">
              {sequence.map((symbol, i) => (
                <li
                  key={i}
                  style={
                    { "--row": Math.floor(i / 3), "--wide-row": Math.floor(i / 5) } as CSSProperties
                  }
                >
                  <small>{i + 1}</small>
                  <span className="loom-patch" aria-label={`Position ${i + 1}: ${symbol}`}>
                    <Embroidery symbol={symbol} />
                  </span>
                </li>
              ))}
              <li>
                <small>{sequence.length + 1} · next</small>
                <button
                  ref={pocket}
                  className={`loom-pocket ${over ? "loom-over" : ""}`}
                  disabled={result === "correct"}
                  aria-label={
                    placed === null
                      ? "Empty pocket, place selected patch"
                      : `Pocket contains ${options[placed]}, pick up or replace`
                  }
                  onClick={() => {
                    if (picked !== null) place(picked);
                    else if (placed !== null) {
                      setPicked(placed);
                      setPlaced(null);
                      setResult("ready");
                    }
                  }}
                >
                  {placed === null ? (
                    <span>{picked === null ? "?" : "Place here"}</span>
                  ) : (
                    <span className="loom-patch loom-placed" key={placed}>
                      <Embroidery symbol={(options[placed] ?? "")} />
                    </span>
                  )}
                  <i className="loom-stitches" aria-hidden="true" />
                </button>
              </li>
            </ol>
          </div>
          </div>
          <div className="loom-beater" aria-hidden="true" />
          <div className="loom-roller" aria-hidden="true" />
        </div>
        <div className="loom-pegs" aria-label="Answer patches">
          {options.map((symbol, index) => (
            <button
              ref={(el) => {
                pegs.current[index] = el;
              }}
              key={index}
              className={`loom-peg ${picked === index ? "loom-picked" : ""} ${placed === index || carry?.index === index ? "loom-vacant" : ""}`}
              disabled={result === "correct" || placed === index}
              aria-label={`Pick patch ${index + 1}: ${symbol}`}
              aria-pressed={picked === index}
              onPointerDown={(e) => {
                if (e.button !== 0 || carry) return;
                const x = e.clientX,
                  y = e.clientY;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                const timer = setTimeout(() => {
                  const g = gesture.current;
                  if (!g) return;
                  g.lifted = true;
                  setPicked(index);
                  setCarry({ index, x: g.x, y: g.y - 52 });
                }, 330);
                gesture.current = { index, x, y, timer, lifted: false };
              }}
              onPointerMove={(e) => {
                const g = gesture.current;
                if (!g) return;
                if (!g.lifted && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) {
                  clearTimeout(g.timer);
                  gesture.current = null;
                  return;
                }
                g.x = e.clientX;
                g.y = e.clientY;
                move(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => finish(e.clientX, e.clientY)}
              onPointerCancel={(e) => finish(e.clientX, e.clientY, true)}
              onClick={() => {
                if (!suppressClick.current) setPicked(picked === index ? null : index);
              }}
            >
              <span className="loom-patch">
                <Embroidery symbol={symbol} />
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="loom-help">
        {picked === null
          ? "Hold to lift, or tap a patch then tap the pocket."
          : "Tap the pocket to place. Escape cancels."}
      </p>
      <div
        className="loom-actions"
        onKeyDown={(e) => {
          if (e.key === "Escape") setPicked(null);
        }}
      >
        <button
          className={`loom-check ${result === "wrong" ? "loom-check-wrong" : ""} ${placed !== null && result === "ready" ? "loom-check-ready" : ""}`}
          disabled={placed === null || result === "correct"}
          onClick={() => {
            if (result === "wrong") {
              setResult("ready");
              setPicked(null);
              return;
            }
            if (placed === null) return;
            const ok = check(placed);
            chime(ok);
            setResult(ok ? "correct" : "wrong");
            if (ok) {
              setWeaving(true);
              timers.current.push(setTimeout(() => setWeaving(false), 1100));
            }
          }}
        >
          {result === "wrong" ? "Try again" : result === "correct" ? "Woven!" : "Check"}
        </button>
        <button
          disabled={placed === null || result === "correct"}
          onClick={() => {
            setPlaced(null);
            setResult("ready");
          }}
        >
          Undo
        </button>
      </div>
      <div className={`loom-feedback ${result}`} role="status" aria-live="polite">
        {result === "wrong"
          ? "That patch breaks the pattern. Try another!"
          : result === "correct"
            ? "You found the pattern! Your cloth is woven."
            : ""}
      </div>
      {carry && (
        <span
          className={`loom-patch loom-carry ${carry.returning ? "loom-return" : ""}`}
          style={{ left: carry.x, top: carry.y }}
          aria-hidden="true"
        >
          <Embroidery symbol={(options[carry.index] ?? "")} />
        </span>
      )}
      <button
        className="loom-cancel"
        hidden={picked === null}
        onClick={() => setPicked(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPicked(null);
        }}
      >
        Cancel pickup
      </button>
    </section>
  );
}
