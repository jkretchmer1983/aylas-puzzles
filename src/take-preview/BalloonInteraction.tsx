import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CornerUpLeft, Hand, HelpCircle, RotateCcw, Undo2 } from 'lucide-react';
import { balloonCenter, inReleaseZone, playReducer, takeClues, type PlayAction, type PlayState, type Point } from './model';
import type { PuzzleSpec } from '../gen/types';

export type BalloonInteractionProps = {
  spec: PuzzleSpec; play: PlayState; onPlayChange: (play: PlayState) => void;
  onCheck: (answer: string) => boolean; reduced: boolean; sessionKey: string;
  onAnnounce: (message: string) => void; onNext: () => void; onPrevious: () => void;
  previousDisabled: boolean; onNew: () => void; onStory: () => void; onHint: () => void; hintOpen: boolean;
  onReleaseSound?: () => void; started?: boolean; onNotice?: (notice:string)=>void;
};
type Drag = { id: number; center: Point; over: boolean };
type Gesture = { id: number; pointerId: number; start: Point; last: Point; active: boolean; target: HTMLButtonElement; timer: ReturnType<typeof setTimeout> | null };
type Moving = { id: number; x: number; y: number; endX: number; endY: number; revision: number };
const art = '/take-airfield/';
export function BalloonInteraction(props: BalloonInteractionProps) {
  const { spec, play, reduced } = props;
  const clues = takeClues(spec);
  const stage = useRef<HTMLDivElement>(null), releaseZone = useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flights, setFlights] = useState<Moving[]>([]);
  const [celebrationFlights, setCelebrationFlights] = useState<Moving[]>([]);
  const [returns, setReturns] = useState<Moving[]>([]);
  const [launchStyle,setLaunchStyle]=useState<CSSProperties>();
  const [notice, setNotice] = useState('Hold a balloon to lift it · or tap to select');
  const [celebrated, setCelebrated] = useState(false);
  const [recalled, setRecalled] = useState<number[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const schedule = (callback:()=>void, ms:number) => { const timer=setTimeout(()=>{callback();timers.current.delete(timer)},ms);timers.current.add(timer); };
  const dispatch = (action: PlayAction) => {
    const current = latest.current, next=playReducer(current.play, action);
    latest.current={...current,play:next}; // Lock committed IDs immediately, before React paints.
    current.onPlayChange(next);
  };
  function cancelGesture() {
    const g = gesture.current;
    gesture.current = null;
    if (g) { if (g.timer) clearTimeout(g.timer); if (g.active) suppressClick.current = g.id; if (g.target.hasPointerCapture?.(g.pointerId)) g.target.releasePointerCapture(g.pointerId); }
    setDrag(null);
  }
  useEffect(() => {
    const cancel = () => cancelGesture();
    window.addEventListener('resize',cancel);window.addEventListener('orientationchange',cancel);window.addEventListener('blur',cancel);
    const visibility=()=>{if(document.hidden)cancelGesture()};document.addEventListener('visibilitychange',visibility);
    return()=>{cancelGesture();window.removeEventListener('resize',cancel);window.removeEventListener('orientationchange',cancel);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);timers.current.forEach(clearTimeout)};
  }, []);
  useEffect(() => { cancelGesture();timers.current.forEach(clearTimeout);timers.current.clear();setFlights([]);setReturns([]);setRecalled([]);setNotice('Hold a balloon to lift it · or tap to select'); }, [props.sessionKey]);
  useEffect(()=>{
    setCelebrated(false);
    if(play.result!==true){setCelebrationFlights([]);return;}
    cancelGesture();setReturns([]);
    setCelebrationFlights(Array.from({length:clues.total},(_,id)=>{
      const released=latest.current.play.released.includes(id);
      const p=released?{x:48+(id%4)*12,y:8+(id%3)*12}:home(id);
      return {id,...p,endX:p.x+(id%2?18:-18),endY:-90,revision:Date.now()};
    }));
    const timer=setTimeout(()=>setCelebrated(true),reduced?0:2800);
    return()=>clearTimeout(timer);
  },[play.result,reduced,props.sessionKey]);
  useEffect(()=>{props.onNotice?.(notice)},[notice,props.onNotice]);
  useEffect(()=>{
    const field=stage.current,root=field?.closest('.take-preview'),banner=root?.querySelector('.take-task');
    if(!field||!banner)return;
    const align=()=>{const a=field.getBoundingClientRect(),b=banner.getBoundingClientRect();setLaunchStyle({left:b.left+b.width*.08-a.left,top:b.bottom+6-a.top,width:b.width*.84,height:44});};
    align();const observer=new ResizeObserver(align);observer.observe(field);observer.observe(banner);
    window.addEventListener('resize',align);return()=>{observer.disconnect();window.removeEventListener('resize',align)};
  },[props.started]);
  function dragBounds(){return stage.current?.closest('.take-preview')?.getBoundingClientRect()||stage.current!.getBoundingClientRect()}
  function position(g: Gesture, finger: Point) {
    if (!stage.current || !releaseZone.current) return;
    const rect = stage.current.getBoundingClientRect();
    const center = balloonCenter(finger, dragBounds());
    setDrag({ id:g.id,center:{x:center.x-rect.left,y:center.y-rect.top},over:inReleaseZone(center,releaseZone.current.getBoundingClientRect(),8) });
  }
  function activate(g: Gesture) {
    if (gesture.current !== g || latest.current.play.countMode) return;
    g.active=true;suppressClick.current=g.id;setNotice('Lift into the sky. Let go when the line lights up.');position(g,g.last);
  }
  function pointerDown(e: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (play.result===true || !e.isPrimary || e.button !== 0 || gesture.current || play.countMode) return;
    suppressClick.current=null;
    const point={x:e.clientX,y:e.clientY};
    const g:Gesture={id,pointerId:e.pointerId,start:point,last:point,active:false,target:e.currentTarget,timer:null};
    gesture.current=g;g.target.setPointerCapture(e.pointerId);g.timer=setTimeout(()=>activate(g),300);
  }
  function pointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;
    g.last={x:e.clientX,y:e.clientY};
    if(!g.active&&Math.hypot(g.last.x-g.start.x,g.last.y-g.start.y)>9){if(g.timer)clearTimeout(g.timer);activate(g)}
    if(g.active){e.preventDefault();position(g,g.last)}
  }
  function home(id:number):Point {
    const b=stage.current?.querySelector<HTMLButtonElement>(`[data-balloon-id="${id}"]`)?.getBoundingClientRect();
    const r=stage.current?.getBoundingClientRect();
    return b&&r?{x:(b.left+b.width/2-r.left)/r.width*100,y:(b.top+b.height/2-r.top)/r.height*100}:{x:50,y:70};
  }
  function release(ids:number[],at?:{id:number;left:number;top:number}) {
    if(latest.current.play.result===true)return;
    const available=[...new Set(ids)].filter(id=>!latest.current.play.released.includes(id));if(!available.length)return;
    const r=stage.current?.getBoundingClientRect();
    const next=available.map(id=>{const p=at?.id===id&&r?{x:at.left/r.width*100,y:at.top/r.height*100}:home(id);return {id,...p,endX:48+(id%4)*12,endY:8+(id%3)*12,revision:Date.now()}});
    setReturns(old=>old.filter(f=>!available.includes(f.id)));
    setFlights(old=>[...old.filter(f=>!available.includes(f.id)),...next]);
    dispatch({type:'release',ids:available,total:clues.total});props.onReleaseSound?.();
    setNotice('Count only the balloons still tied to their anchors.');
    props.onAnnounce(`${available.length} ${clues.balloon?'balloon':'parcel'}${available.length===1?'':'s'} released. Undo recalls the most recent one.`);
  }
  function returnToAnchor(id:number,from:Point) {
    if(reduced)return;
    const to=home(id),revision=Date.now();
    setReturns(old=>[...old.filter(f=>f.id!==id),{id,...from,endX:to.x,endY:to.y,revision}]);
    schedule(()=>setReturns(old=>old.filter(f=>f.revision!==revision)),460);
  }
  function pointerUp(e:ReactPointerEvent<HTMLButtonElement>) {
    const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;
    if(g.timer)clearTimeout(g.timer);
    if(g.active&&stage.current&&releaseZone.current){
      const rect=stage.current.getBoundingClientRect(),center=balloonCenter({x:e.clientX,y:e.clientY},dragBounds());
      const moved=Math.hypot(e.clientX-g.start.x,e.clientY-g.start.y)>9;
      if(moved&&inReleaseZone(center,releaseZone.current.getBoundingClientRect(),8))release([g.id],{id:g.id,left:center.x-rect.left,top:center.y-rect.top});
      else {returnToAnchor(g.id,{x:(center.x-rect.left)/rect.width*100,y:(center.y-rect.top)/rect.height*100});setNotice('Back on its anchor. You can also tap, then Release.');}
    }
    cancelGesture();
  }
  function undo() {
    cancelGesture();const id=play.released.at(-1);if(id===undefined)return;
    setFlights(old=>old.filter(f=>f.id!==id));setRecalled([id]);dispatch({type:'undo'});
    // Source touch target returns immediately; the image follows a short recall path.
    schedule(()=>returnToAnchor(id,{x:48+(id%4)*12,y:8+(id%3)*12}),0);
    setNotice('One balloon recalled to its original anchor.');props.onAnnounce('Last balloon recalled. Your answer is unchanged.');
  }
  const ready=Boolean(play.answer)&&play.result===null;
  const answerInput=useRef<HTMLInputElement>(null);
  const replaceAnswer=useRef(false);
  const objectName=clues.balloon?'Balloon':`${clues.object} parcel`;
  const count=clues.total,cols=Math.min(4,count),rows=Math.ceil(count/cols);
  const retry=()=>{dispatch({type:'retry'});replaceAnswer.current=true;answerInput.current?.focus();answerInput.current?.select();props.onAnnounce('Try again. Your balloons and answer are still here.');};
  const check=()=>{if(play.result===false){retry();return}const ok=props.onCheck(play.answer);setNotice(ok?'Up and away! You did it.':'Your balloons and work are safe. Try again.');dispatch({type:'checked',ok})};
  const moveStyle=(m:Moving)=>({'--from-x':`${m.x}%`,'--from-y':`${m.y}%`,'--to-x':`${m.endX}%`,'--to-y':`${m.endY}%`,'--flight-tilt':`${(m.id%2?1:-1)*8}deg`} as CSSProperties);
  return <div className={`take-game ${play.result===true?'is-celebrating':''} ${play.result===false?'has-error':''}`} data-result={play.result===true?'correct':play.result===false?'incorrect':'editing'} inert={props.started===false?true:undefined}>
    <section className={`take-airfield ${drag?'is-dragging':''}`} aria-label="Balloon airfield" data-rows={rows} ref={stage}>
      <button ref={releaseZone} style={launchStyle} className={`take-launch ${drag?.over?'is-over':''} ${drag||play.selected.length?'is-visible':''}`} disabled={!play.selected.length&&!drag} onClick={()=>release(play.selected)} aria-label={play.selected.length?`Release ${play.selected.length}`:'Select a balloon, then release here'}><span>{drag?.over?'Let go — up and away!':play.selected.length?`Release ${play.selected.length} to the sky`:'Lift above this line to release'}</span><ArrowRight aria-hidden="true" /></button>
      <div className="take-launch-task">Take away {clues.removed}{clues.balloon?' balloons':` ${clues.object}`}</div>
      <div className="take-balloon-grid" aria-label="Tethered balloons">
      {Array.from({length:count},(_,id)=>{
        const released=play.released.includes(id),selected=play.selected.includes(id),marked=play.marked.includes(id);
        const returning=returns.some(f=>f.id===id);
        const col=id%cols,row=Math.floor(id/cols),left=12+(col+.5)/cols*78,top=rows===1?81:61+row*31;
        return <div className="take-balloon-slot" key={id} style={{left:`${left}%`,top:`${top}%`,'--bob-delay':`${id*-.63}s`,'--assemble-delay':`${id*45}ms`,'--base-left':`${left}%`,'--slot-i':id,'--slot-row':row,'--total':count} as CSSProperties}>
          <img className="take-anchor" src={`${art}anchor.webp`} alt="" draggable={false}/>
          {!released&&<>
            <svg className="take-tether" viewBox="0 0 60 70" aria-hidden="true"><path d="M30 2 Q26 34 30 66" fill="none" stroke="#ead2a2" strokeWidth="1.8">{!reduced&&<animate attributeName="d" values="M30 2 Q26 34 30 66;M30 2 Q34 34 30 66;M30 2 Q26 34 30 66" dur="4.8s" begin={`${id*-.4}s`} repeatCount="indefinite"/>}</path></svg>
            <button data-balloon-id={id} disabled={play.result===true} className={`take-balloon-target ${selected?'is-selected':''} ${marked?'is-marked':''} ${drag?.id===id||returning?'is-carried':''} ${recalled.includes(id)?'is-recalled':''}`} aria-label={`${objectName} ${id+1}${marked?', counted':''}`} aria-pressed={play.countMode?marked:selected} onPointerDown={e=>pointerDown(e,id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelGesture} onLostPointerCapture={()=>{if(gesture.current?.active)cancelGesture()}} onClick={e=>{if(e.detail!==0&&suppressClick.current===id){suppressClick.current=null;return}dispatch({type:'select',id})}} onKeyDown={e=>{if(e.key==='Escape'){cancelGesture();if(selected)dispatch({type:'select',id})}}}>
              <Balloon object={clues.balloon?null:clues.object}/>{selected&&<span className="take-selection-tick" aria-hidden="true">✓</span>}{marked&&<span className="take-count-dot" aria-hidden="true">✓</span>}
            </button>
          </>}
        </div>;
      })}
      </div>
      <div className="take-released-fleet" aria-hidden="true">{play.released.map((id,index)=>{
        const f=flights.find(f=>f.id===id)||{id,x:50,y:60,endX:48+(id%4)*12,endY:8+(id%3)*12,revision:0};
        return <div key={`${id}-${f.revision}`} className={`take-flight ${f.revision?'is-new':''}`} style={{...moveStyle(f),'--formation-x':`${38+index*9}%`,'--formation-y':`${8+Math.abs(index-(play.released.length-1)/2)*7}%`} as CSSProperties}><Balloon object={clues.balloon?null:clues.object}/><LooseString reduced={reduced}/></div>;
      })}</div>
      {play.result===true&&!reduced&&<div className="take-celebration-fleet" aria-hidden="true">{celebrationFlights.map(f=><div key={f.id} className={`take-celebration-flight ${play.released.includes(f.id)?'was-released':''}`} style={{...moveStyle(f),'--departure-delay':`${f.id*45}ms`} as CSSProperties}><Balloon object={clues.balloon?null:clues.object}/><LooseString reduced={reduced}/></div>)}</div>}
      {returns.map(f=><div key={`${f.id}-${f.revision}`} className="take-return" style={moveStyle(f)} aria-hidden="true"><Balloon object={clues.balloon?null:clues.object}/></div>)}
      {drag&&<div className={`take-carried ${drag.over?'is-over':''}`} style={{left:drag.center.x,top:drag.center.y} as CSSProperties} aria-hidden="true"><Balloon object={clues.balloon?null:clues.object}/><LooseString reduced={reduced}/></div>}
    </section>
    <img className="take-explorer" src={`${art}${play.result===true?'explorer-cheer':'explorer'}.webp`} alt="A young weather explorer watching the balloons" draggable={false}/>
    <div className="take-windsock-rig" aria-hidden="true"><span className="take-windsock-pole"/><img className="take-windsock" src={`${art}windsock.webp`} alt="" draggable={false}/></div>
    <div className="take-action-rail"><button onClick={()=>{cancelGesture();dispatch({type:'count-mode'})}} aria-pressed={play.countMode}><Hand/><span>{play.countMode?'Counting marks on':'Mark to count'}</span></button></div>
    <p className="take-sr-only" aria-live="polite">{props.onNotice?'':notice}</p>
    <section className="take-console" aria-label="Answer controls">
      <div className="take-answer-row"><button className="take-undo" onClick={undo} disabled={!play.released.length}><Undo2/><span>Undo</span></button><label className="take-sr-only" htmlFor="take-answer">How many are left?</label><div className="take-answer-window"><input ref={answerInput} id="take-answer" aria-label="Your answer" inputMode="none" value={play.answer} placeholder="?" onChange={e=>props.onPlayChange({...play,answer:e.target.value.replace(/\D/g,'').slice(0,4),result:null})} onKeyDown={e=>{if(e.key==='Enter'&&play.answer)check()}}/><button className="take-erase" aria-label="Erase last digit" onClick={()=>{replaceAnswer.current=false;dispatch({type:'erase'})}}><CornerUpLeft/></button></div><button className={`take-check ${ready?'is-ready':''} ${play.result===false?'is-retry':''}`} disabled={!play.answer} onClick={check} aria-label={play.result===false?'Try again':'Check my answer'}>{play.result===false?'Try again':'Check'}</button></div>
      <div className="take-number-keys" aria-label="Number keys">{['1','2','3','4','5','6','7','8','9','0'].map(d=><button key={d} aria-label={d} onClick={()=>{dispatch({type:'digit',digit:d,replace:replaceAnswer.current});replaceAnswer.current=false}}>{d}</button>)}</div>
    </section>
    <div className={`take-feedback ${play.result===true?'is-correct':''} ${play.result===false?'is-incorrect':''}`} role="status" aria-live="polite">{play.result===true?<><span className="take-success-mark">✓</span>{celebrated?'Correct! Ready for another?':'Wonderful! Watch them fly!'}</>:play.result===false?<><span aria-hidden="true">↶</span>Not quite. Try again — your work is safe.</>:props.hintOpen?spec.hint:''}</div>
    <nav className="take-navigation" aria-label="Puzzle navigation"><button onClick={props.onPrevious} disabled={props.previousDisabled} aria-label="Previous puzzle"><ArrowLeft/><span>Previous</span></button><button onClick={props.onNew}><RotateCcw/><span>New</span></button><button className={`take-next-button ${play.result===true&&celebrated?'take-next-primary':''}`} onClick={props.onNext}><span className="take-next-short">Next</span><span className="take-next-long">Next puzzle</span><ArrowRight/></button></nav>
    <div className="take-books"><button className="take-story-button" onClick={props.onStory} aria-label="Open story"><BookOpen/><span>Story<br/>Flightlog</span></button><button className="take-hint-button" onClick={props.onHint} aria-pressed={props.hintOpen} aria-label="Need a hint?"><HelpCircle/><span>Hint</span></button></div>
    {props.hintOpen&&<aside className="take-hint-note"><strong>A little clue</strong><p>{spec.hint}</p><button onClick={props.onHint}>Close hint</button></aside>}
  </div>;
}
function Balloon({object}:{object:string|null}) {return <span className="take-balloon-art" aria-hidden="true"><img src={`${art}balloon.webp`} alt="" draggable={false}/>{object&&<span className="take-parcel">{object}</span>}</span>}
function LooseString({reduced}:{reduced:boolean}) {return <svg className="take-loose-string" viewBox="0 0 60 70" aria-hidden="true"><path d="M30 0 C48 12 14 32 32 45 S20 60 24 68" fill="none" stroke="#f0d6a3" strokeWidth="1.8">{!reduced&&<animate attributeName="d" values="M30 0 C31 12 29 32 30 45 S29 60 30 68;M30 0 C48 12 14 32 32 45 S20 60 24 68;M30 0 C14 12 45 32 24 45 S35 60 30 68" dur=".8s" repeatCount="indefinite"/>}</path></svg>}
