import { ArrowUp, CornerUpLeft, CornerUpRight, Grip, Repeat2, Trash2 } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BaseOp, ProgramToken, RobotAction, RobotPhase } from "./types";
import { playRobotSound } from "./audio";

function CommandIcon({ op }: { op: BaseOp }) {
  if (op === "forward") return <ArrowUp aria-hidden="true" />;
  if (op === "left") return <CornerUpLeft aria-hidden="true" />;
  return <CornerUpRight aria-hidden="true" />;
}

const opName = (op: BaseOp) => op === "forward" ? "Move forward one tile" : op === "left" ? "Turn left in place" : "Turn right in place";

function TokenFace({ token }: { token: ProgramToken | { op: BaseOp } }) {
  return token.op === "repeat"
    ? <><span className="robot-repeat-body"><CommandIcon op={token.body} /></span><strong>×{token.times}</strong></>
    : <CommandIcon op={token.op} />;
}

type DragSource = { kind: "palette"; op: BaseOp } | { kind: "program"; index: number; token: ProgramToken };
type DragVisual = { x: number; y: number; source: DragSource } | null;

export function ProgramRail({ program, maxTokens, allowsRepeat, phase, activeTokenId, dispatch }: {
  program: ProgramToken[];
  maxTokens: number;
  allowsRepeat: boolean;
  phase: RobotPhase;
  activeTokenId: string | null;
  dispatch: (action: RobotAction) => void;
}) {
  const [pickedOp, setPickedOp] = useState<BaseOp | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragVisual>(null);
  const dragSource = useRef<DragSource | null>(null);
  const pointer = useRef({ id: -1, x: 0, y: 0, startX: 0, startY: 0, active: false, timer: 0 });
  const suppressClick = useRef(false);
  const editing = phase !== "running";

  const begin = (source: DragSource, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editing || event.button !== 0) return;
    const p = pointer.current;
    window.clearTimeout(p.timer);
    dragSource.current = source;
    p.id = event.pointerId; p.x = p.startX = event.clientX; p.y = p.startY = event.clientY; p.active = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    p.timer = window.setTimeout(() => {
      p.active = true;
      setDrag({ x: p.x, y: p.y - 76, source });
      playRobotSound("pickup");
      if (navigator.vibrate) navigator.vibrate(18);
    }, 260);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (p.id !== event.pointerId) return;
    p.x = event.clientX; p.y = event.clientY;
    if (p.active) { event.preventDefault(); setDrag({ x: p.x, y: p.y - 76, source: dragSource.current! }); }
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (p.id !== event.pointerId) return;
    window.clearTimeout(p.timer);
    const source = dragSource.current;
    if (p.active && source) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop-index]");
      const index = target ? Number(target.dataset.dropIndex) : null;
      if (source.kind === "palette" && index !== null) dispatch({ type: "insert", op: source.op, index });
      if (source.kind === "program") {
        if (index === null) dispatch({ type: "remove", index: source.index });
        else if (index !== source.index) dispatch({ type: "move", from: source.index, to: Math.min(index, program.length - 1) });
      }
      playRobotSound("drop");
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 50);
    }
    p.id = -1; p.active = false; dragSource.current = null; setDrag(null);
    setPickedIndex(null);
  };
  const cancel = () => {
    window.clearTimeout(pointer.current.timer);
    pointer.current.id = -1; pointer.current.active = false; dragSource.current = null; setDrag(null);
  };
  const paletteClick = (op: BaseOp) => {
    if (suppressClick.current || !editing) return;
    setPickedIndex(null);
    if (pickedOp === op) { dispatch({ type: "add", op }); setPickedOp(null); }
    else setPickedOp(op);
  };
  const slotClick = (index: number) => {
    if (suppressClick.current || !editing) return;
    if (pickedOp) {
      dispatch({ type: "insert", op: pickedOp, index });
      setPickedOp(null); setPickedIndex(null); playRobotSound("drop");
    } else if (pickedIndex !== null && pickedIndex !== index && index < program.length) {
      dispatch({ type: "move", from: pickedIndex, to: index }); setPickedIndex(null);
    } else setPickedIndex(index < program.length ? (pickedIndex === index ? null : index) : null);
  };

  return <section className="robot-program-area" aria-label="Route programming trolley">
    <div className="robot-trolley">
      <div className="robot-trolley-handle left" aria-hidden="true" /><div className="robot-trolley-handle right" aria-hidden="true" />
      <div className="robot-rail-heading">
        <span><Grip aria-hidden="true" /> Program trolley</span>
        <span>{program.length}/{maxTokens} blocks</span>
        {pickedIndex !== null && <button className="robot-remove-command" onClick={() => { dispatch({ type: "remove", index: pickedIndex }); setPickedIndex(null); }}><Trash2 aria-hidden="true" /> Remove</button>}
      </div>
      <div className="robot-program-rail" data-drop-index={program.length} aria-label="Program slots">
        {Array.from({ length: maxTokens }, (_, index) => {
          const token = program[index];
          return <div className={`robot-program-slot ${pickedOp ? "awaiting" : ""}`} key={index} data-drop-index={index}>
            {token ? <button
              className={`robot-command-token ${token.op === "repeat" ? "repeat" : token.op} ${activeTokenId === token.id ? "executing" : ""} ${pickedIndex === index ? "picked" : ""}`}
              disabled={!editing}
              aria-label={`${index + 1}. ${token.op === "repeat" ? `Repeat ${opName(token.body)} ${token.times} times` : opName(token.op)}${pickedIndex === index ? ", selected" : ""}`}
              onPointerDown={e => begin({ kind: "program", index, token }, e)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}
              onClick={() => slotClick(index)}
              onKeyDown={e => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault(); dispatch({ type: "move", from: index, to: index + (e.key === "ArrowLeft" ? -1 : 1) });
                }
                if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); dispatch({ type: "remove", index }); }
              }}
            ><TokenFace token={token} /></button> : <button className="robot-empty-slot" aria-label={`Place command at slot ${index + 1}`} onClick={() => slotClick(index)} disabled={!editing} />}
          </div>;
        })}
      </div>
      <span className="robot-trolley-wheel left" aria-hidden="true" /><span className="robot-trolley-wheel right" aria-hidden="true" />
    </div>
    <div className="robot-token-palette" aria-label="Command tokens">
      {(["forward", "left", "right"] as BaseOp[]).map(op => <button key={op}
        className={`robot-command-token palette ${op} ${pickedOp === op ? "picked" : ""}`}
        disabled={!editing} aria-label={`${opName(op)}. Tap then tap a trolley slot; tap again to append.`} aria-pressed={pickedOp === op}
        onPointerDown={e => begin({ kind: "palette", op }, e)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}
        onClick={() => paletteClick(op)}
      ><CommandIcon op={op} /></button>)}
      {allowsRepeat && <button className="robot-command-token palette repeat" disabled={!editing || !program.length}
        aria-label="Make the last command a repeat block; tap again to change two or three repeats"
        onClick={() => { if (pickedIndex !== null && program[pickedIndex]?.op === "repeat") dispatch({ type: "cycleRepeat", index: pickedIndex }); else dispatch({ type: "repeatLast" }); }}
      ><Repeat2 aria-hidden="true" /><small>2×</small></button>}
    </div>
    <p className="robot-program-help" aria-live="polite">{pickedOp ? `Now tap a trolley slot to place “${opName(pickedOp)}”.` : "Hold to drag · Tap token, then slot · F / L / R keys"}</p>
    {drag && <div className={`robot-carried-token robot-command-token ${drag.source.kind === "palette" ? drag.source.op : drag.source.token.op}`} style={{ left: drag.x, top: drag.y }} aria-hidden="true"><TokenFace token={drag.source.kind === "palette" ? { op: drag.source.op } : drag.source.token} /></div>}
  </section>;
}
