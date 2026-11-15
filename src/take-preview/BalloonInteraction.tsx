import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CornerUpLeft, Hand, HelpCircle, RotateCcw, Undo2 } from 'lucide-react';
import { balloonCenter, inReleaseZone, playReducer, takeClues, type PlayAction, type PlayState, type Point } from './model';
import type { PuzzleSpec } from '../gen/types';

export type BalloonInteractionProps = {
  spec: PuzzleSpec; play: PlayState; onPlayChange: (play: PlayState) => void;
  onCheck: (answer: string) => boolean; reduced: boolean; sessionKey: string;
  onAnnounce: (message: string) => void; onNext: () => void; onPrevious: () => void;
  previousDisabled: boolean; onNew: () => void; onStory: () => void; onHint: () => void; hintOpen: boolean;
};
type Drag = { id: number; center: Point; over: boolean };
type Gesture = { id: number; pointerId: number; start: Point; last: Point; active: boolean; target: HTMLButtonElement; timer: ReturnType<typeof setTimeout> | null };
export function BalloonInteraction(props: BalloonInteractionProps) {
  const { spec, play, reduced } = props;
  const clues = takeClues(spec);
  const stage = useRef<HTMLDivElement>(null), releaseZone = useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flights, setFlights] = useState<{ id: number; left: number; top: number }[]>([]);
  const [notice, setNotice] = useState('Tap to select · hold and drag to the sky');
  const [recalled, setRecalled] = useState<number[]>([]);
  const flightTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const dispatch = (action: PlayAction) => {
    const current = latest.current;
    current.onPlayChange(playReducer(current.play, action));
  };
  function cancelGesture() {
    const g = gesture.current;
    gesture.current = null;
    if (g) { if (g.timer) clearTimeout(g.timer); if (g.active) suppressClick.current = g.id; if (g.target.hasPointerCapture?.(g.pointerId)) g.target.releasePointerCapture(g.pointerId); }
    setDrag(null);
  }
  useEffect(() => {
    const resize = () => cancelGesture();
    const blur = () => cancelGesture();
    window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); window.addEventListener('blur', blur);
    const visibility = () => { if (document.hidden) cancelGesture(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelGesture(); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); flightTimers.current.forEach(clearTimeout); };
  }, []);
  useEffect(() => { cancelGesture(); setFlights([]); setRecalled([]); setNotice('Tap to select · hold and drag to the sky'); }, [props.sessionKey]);
  function position(g: Gesture, finger: Point) {
    if (!stage.current || !releaseZone.current) return;
    const rect = stage.current.getBoundingClientRect();
    const center = balloonCenter(finger, rect);
    const over = inReleaseZone(center, releaseZone.current.getBoundingClientRect());
    setDrag({ id: g.id, center: { x: center.x - rect.left, y: center.y - rect.top }, over });
  }
  function activate(g: Gesture) {
    if (gesture.current !== g || latest.current.play.countMode) return;
    g.active = true; suppressClick.current = g.id;
    setNotice('Move the balloon into the sky, then let go');
    position(g, g.last);
  }
  function pointerDown(e: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (!e.isPrimary || e.button !== 0 || gesture.current || play.countMode) return;
    suppressClick.current = null;
    const point = { x: e.clientX, y: e.clientY };
    const g: Gesture = { id, pointerId: e.pointerId, start: point, last: point, active: false, target: e.currentTarget, timer: null };
    gesture.current = g;
    g.target.setPointerCapture(e.pointerId);
    g.timer = setTimeout(() => activate(g), 350);
  }
  function pointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    g.last = { x: e.clientX, y: e.clientY };
    if (!g.active && Math.hypot(g.last.x - g.start.x, g.last.y - g.start.y) > 9) { if (g.timer) clearTimeout(g.timer); activate(g); }
    if (g.active) { e.preventDefault(); position(g, g.last); }
  }
  function release(ids: number[], at?: { id: number; left: number; top: number }) {
    const available = ids.filter(id => !latest.current.play.released.includes(id));
    if (!available.length) return;
    if (!reduced && stage.current) {
      const rect = stage.current.getBoundingClientRect();
      const next = available.map(id => {
        if (at?.id === id) return at;
        const button = stage.current?.querySelector<HTMLButtonElement>(`[data-balloon-id="${id}"]`);
        const b = button?.getBoundingClientRect();
        return { id, left: b ? b.left + b.width / 2 - rect.left : rect.width / 2, top: b ? b.top + b.height / 2 - rect.top : rect.height / 2 };
      });
      setFlights(old => [...old.filter(f => !available.includes(f.id)), ...next]);
      const timer = setTimeout(() => { setFlights(old => old.filter(f => !available.includes(f.id))); flightTimers.current.delete(timer); }, 900);
      flightTimers.current.add(timer);
    }
    dispatch({ type: 'release', ids: available, total: clues.total });
    setNotice('Count the balloons still tied below');
    props.onAnnounce(`${available.length} ${clues.balloon ? 'balloon' : 'parcel'}${available.length === 1 ? '' : 's'} released. Undo is available.`);
  }
  function pointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.timer) clearTimeout(g.timer);
    if (g.active && stage.current && releaseZone.current) {
      const rect = stage.current.getBoundingClientRect();
      const center = balloonCenter({ x: e.clientX, y: e.clientY }, rect);
      if (inReleaseZone(center, releaseZone.current.getBoundingClientRect())) release([g.id], { id: g.id, left: center.x - rect.left, top: center.y - rect.top });
      else setNotice('Back on its tether. Try again, or tap Release.');
    }
    cancelGesture();
  }
  const undo = () => {
    cancelGesture(); const ids = play.batches.at(-1) || [];
    setFlights(f => f.filter(x => !ids.includes(x.id))); setRecalled(ids);
    dispatch({ type: 'undo' }); setNotice('Recalled. You can select and release again.'); props.onAnnounce('Last release undone.');
  };
  const ready = Boolean(play.answer) && play.result === null;
  const answerInput = useRef<HTMLInputElement>(null);
  const [keyboard, setKeyboard] = useState(false);
  // The preview starts in the youngest enabled band (maximum eight objects).
  const count = Math.min(clues.total, 8);
  const objectName = clues.balloon ? 'Balloon' : `${clues.object} parcel`;
  return <div className="take-game">
    <section className="take-airfield" aria-label="Balloon airfield" ref={stage}>
      <div className="take-cloud take-cloud-one" aria-hidden="true" /><div className="take-cloud take-cloud-two" aria-hidden="true" />
      <button ref={releaseZone} className={`take-launch ${drag?.over ? 'is-over' : ''}`} disabled={!play.selected.length && !drag} onClick={() => release(play.selected)} aria-label={play.selected.length ? `Release ${play.selected.length} selected` : 'Select a balloon, then release here'}><span>{drag?.over ? 'Let go to release' : 'Release to the sky'}</span><ArrowRight aria-hidden="true" /></button>
      <div className="take-launch-task">Take away {clues.removed}{clues.balloon ? ' balloons' : ` ${clues.object}`}</div>
      <div className="take-hills" aria-hidden="true" /><div className="take-hut" aria-hidden="true"><span>WEATHER<br />STATION</span></div><div className="take-windsock" aria-hidden="true"><i /></div>
      <div className="take-balloon-grid" aria-label="Tethered balloons">
        {Array.from({ length: count }, (_, id) => {
          const released = play.released.includes(id), selected = play.selected.includes(id), marked = play.marked.includes(id);
          return <div className="take-balloon-slot" key={id}>
            {!released && <button data-balloon-id={id} className={`take-balloon-target ${selected ? 'is-selected' : ''} ${marked ? 'is-marked' : ''} ${drag?.id === id ? 'is-carried' : ''} ${recalled.includes(id) ? 'is-recalled' : ''}`} aria-label={`${objectName} ${id + 1}${marked ? ', counted' : ''}`} aria-pressed={play.countMode ? marked : selected} onPointerDown={e => pointerDown(e, id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current?.active) cancelGesture(); }} onClick={e => { if (e.detail !== 0 && suppressClick.current === id) { suppressClick.current = null; return; } dispatch({ type: 'select', id }); }} onKeyDown={e => { if (e.key === 'Escape') { cancelGesture(); if (selected) dispatch({ type: 'select', id }); } }}>
              <Balloon object={clues.balloon ? null : clues.object} /><span className="take-tether" aria-hidden="true" /><span className="take-peg" aria-hidden="true" />{selected && <span className="take-selection-tick" aria-hidden="true">✓</span>}{marked && <span className="take-count-dot" aria-hidden="true">•</span>}
            </button>}
          </div>;
        })}
      </div>
      {flights.filter(f => play.released.includes(f.id)).map(f => <div key={f.id} className="take-flight" style={{ left: f.left, top: f.top } as CSSProperties} aria-hidden="true"><Balloon object={clues.balloon ? null : clues.object} /></div>)}
      {drag && <div className={`take-carried ${drag.over ? 'is-over' : ''}`} style={{ left: drag.center.x, top: drag.center.y } as CSSProperties} aria-hidden="true"><Balloon object={clues.balloon ? null : clues.object} /></div>}
    </section>
    <div className="take-action-rail"><button onClick={undo} disabled={!play.batches.length}><Undo2 /><span>Undo</span></button><button onClick={() => { cancelGesture(); dispatch({ type: 'count-mode' }); }} aria-pressed={play.countMode}><Hand /><span>{play.countMode ? 'Count mode on' : 'Mark to count'}</span></button><button className="take-release-button" disabled={!play.selected.length} onClick={() => release(play.selected)}>Release{play.selected.length ? ` ${play.selected.length}` : ''}<ArrowRight /></button></div>
    <p className="take-gesture-tip" aria-live="polite">{notice}</p>
    <section className="take-console" aria-label="Answer controls">
      <div className="take-answer-row"><label htmlFor="take-answer">How many<br />are left?</label><input ref={answerInput} id="take-answer" aria-label="Your answer" inputMode="none" value={play.answer} placeholder="?" readOnly={!keyboard} onFocus={() => setKeyboard(true)} onChange={e => { const value = e.target.value.replace(/\D/g, '').slice(0, 4); props.onPlayChange({ ...play, answer: value, result: null }); }} onKeyDown={e => { if (e.key === 'Enter' && play.answer) dispatch({ type: 'checked', ok: props.onCheck(play.answer) }); }} /><button className={`take-check ${ready ? 'is-ready' : ''}`} disabled={!play.answer} onClick={() => dispatch({ type: 'checked', ok: props.onCheck(play.answer) })}>Check my answer</button></div>
      <div className="take-number-keys" aria-label="Number keys">{['1','2','3','4','5','6','7','8','9','0'].map(d => <button key={d} aria-label={d} onClick={() => dispatch({ type: 'digit', digit: d })}>{d}</button>)}<button className="take-erase" aria-label="Erase last digit" onClick={() => dispatch({ type: 'erase' })}><CornerUpLeft /></button></div>
    </section>
    <div className={`take-feedback ${play.result === true ? 'is-correct' : ''}`} role="status" aria-live="polite">{play.result === true ? <><span className="take-success-mark">✓</span>Correct! Ready for another?</> : play.result === false ? <><span>Not quite. Try again.</span><button onClick={() => { dispatch({ type: 'erase' }); answerInput.current?.focus(); }}>Edit answer</button></> : props.hintOpen ? spec.hint : ''}</div>
    <nav className="take-navigation" aria-label="Puzzle navigation"><button onClick={props.onPrevious} disabled={props.previousDisabled} aria-label="Previous puzzle"><ArrowLeft /><span>Previous</span></button><button onClick={props.onNew}><RotateCcw /><span>New</span></button><button className={play.result === true ? 'take-next-primary' : ''} onClick={props.onNext}><span>Next</span><ArrowRight /></button><button className="take-story-button" onClick={props.onStory} aria-label="Open story"><BookOpen /><span>Story</span></button><button onClick={props.onHint} aria-pressed={props.hintOpen} aria-label="Need a hint?"><HelpCircle /><span>Hint</span></button></nav>
  </div>;
}
function Balloon({ object }: { object: string | null }) {
  return <span className="take-balloon-art" aria-hidden="true"><span className="take-balloon-shine" /><span className="take-balloon-knot" />{object && <span className="take-parcel">{object}</span>}</span>;
}
