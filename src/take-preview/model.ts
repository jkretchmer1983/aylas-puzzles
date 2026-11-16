import type { PuzzleSpec } from '../gen/types';

/** Read only public task data. No answers enter the scene model. */
export function takeClues(spec: Pick<PuzzleSpec, 'template' | 'task'>) {
  if (spec.template !== 'take') throw new Error('Taking Away requires a take puzzle');
  const match = /^There were (\d+) (.+)\. (\d+) were taken\. How many are left\?$/.exec(spec.task);
  if (!match) throw new Error('Unsupported Taking Away task; keep the original renderer');
  const total = Number(match[1]), removed = Number(match[3]);
  if (total < 1 || removed < 1 || removed >= total) throw new Error('Invalid public task');
  const object = match[2];
  if (!object) throw new Error('Missing Taking Away object');
  return { total, removed, object, balloon: object === '🎈' };
}
export type PlayState = {
  selected: number[]; released: number[]; batches: number[][];
  marked: number[]; countMode: boolean; answer: string; result: boolean | null;
};
export const emptyPlay = (): PlayState => ({ selected: [], released: [], batches: [], marked: [], countMode: false, answer: '', result: null });
export type PlayAction =
  | { type: 'select'; id: number }
  | { type: 'release'; ids: number[]; total: number }
  | { type: 'undo' } | { type: 'count-mode' }
  | { type: 'digit'; digit: string; replace?: boolean } | { type: 'erase' }
  | { type: 'checked'; ok: boolean } | { type: 'retry' };
export function playReducer(s: PlayState, a: PlayAction): PlayState {
  switch (a.type) {
    case 'select': {
      if (s.released.includes(a.id)) return s;
      const key = s.countMode ? 'marked' : 'selected';
      return { ...s, [key]: s[key].includes(a.id) ? s[key].filter(id => id !== a.id) : [...s[key], a.id], result: null };
    }
    case 'release': {
      const ids = [...new Set(a.ids)].filter(id => Number.isInteger(id) && id >= 0 && id < a.total && !s.released.includes(id));
      if (!ids.length) return s;
      return { ...s, released: [...s.released, ...ids], selected: s.selected.filter(id => !ids.includes(id)), marked: s.marked.filter(id => !ids.includes(id)), batches: [...s.batches, ids], result: null };
    }
    case 'undo': {
      const last = s.released.at(-1);
      if (last === undefined) return s;
      return { ...s, released: s.released.slice(0,-1), batches: s.batches.map(batch => batch.filter(id => id !== last)).filter(batch => batch.length), result: null };
    }
    case 'count-mode': return { ...s, countMode: !s.countMode, selected: [] };
    case 'digit': return /^\d$/.test(a.digit) ? { ...s, answer: ((a.replace?'':s.answer) + a.digit).slice(0, 4), result: null } : s;
    case 'erase': return { ...s, answer: s.answer.slice(0, -1), result: null };
    case 'retry': return { ...s, result: null };
    case 'checked': return s.answer ? { ...s, result: a.ok } : s;
  }
}
export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };
/** Hit testing uses the carried balloon's displayed center, never the raw finger. */
export function balloonCenter(finger: Point, stage: Rect): Point {
  return { x: Math.max(stage.left + 28, Math.min(stage.right - 28, finger.x)), y: Math.max(stage.top + 34, Math.min(stage.bottom - 40, finger.y - 64)) };
}
export function inReleaseZone(center: Point, zone: Rect, tolerance = 12) {
  return center.x >= zone.left - tolerance && center.x <= zone.right + tolerance && center.y >= zone.top - tolerance && center.y <= zone.bottom + tolerance;
}

/** A generous sky region around and below the sign, in scene coordinates. */
export function skyReleaseBounds(scene:Rect,banner:Rect):Rect {
  const height=scene.bottom-scene.top;
  return {left:scene.left+12,right:scene.right-12,top:scene.top+12,bottom:Math.min(scene.bottom-80,banner.bottom+Math.max(96,Math.min(164,height*.14)))};
}

export type FleetInput = {
  count: number; width: number; height: number;
  /** Bottom of the instruction sign; floating needs open sky below it. */
  skyTop: number; obstacles: Rect[]; body: number; portrait: boolean;
  ground?: {top:number;bottom:number}; seed?:string;
};
export type FleetSlot = { x: number; y: number };
export type FleetLayout = { body: number; slots: FleetSlot[] };
/**
 * Places anchored balloons in open meadow (scene coordinates, balloon centre x and
 * footprint top y). Rows are filled from the lowest free ground upward so the fleet
 * sits near the viewer with generous sky above for release flights. Footprints and
 * touch boxes never intersect obstacles or each other.
 */
export function layoutFleet(input: FleetInput): FleetLayout {
  const { count, width, skyTop, obstacles, portrait } = input;
  const bottomLimit = Math.min(input.height - 8,input.ground?.bottom??input.height);
  for (const scale of [1, .9, .8, .7, .62, .55]) {
    const body = Math.round(input.body * scale);
    const touchW = Math.max(body, 48), touchH = Math.max(body * 1.3, 62);
    const foot = body * (input.ground?1.92:2.12), dx = touchW + Math.max(4, body * .1), dy = touchH + 8;
    const travel = portrait ? Math.max(90, input.height * .14) : Math.max(56, input.height * .1);
    for (const maxRows of [2, 3, 4]) {
      const minTop = input.ground ? input.ground.top-foot : skyTop + travel;
      const rows: FleetSlot[][] = [];
      let remaining = count, y = bottomLimit - foot;
      while (remaining > 0 && rows.length < maxRows && y >= minTop) {
        const need = Math.ceil(remaining / (maxRows - rows.length));
        const intervals = freeIntervals(y, foot, touchW, width, obstacles);
        const capacity = intervals.map(([a, b]) => Math.max(0, Math.floor((b - a) / dx) + 1));
        const total = capacity.reduce((s, c) => s + c, 0);
        if (total < need) { y -= 4; continue; }
        const take = Math.min(remaining, total);
        rows.push(spread(intervals, capacity, take, dx).map(x => ({ x, y })));
        remaining -= take; y -= dy;
      }
      if (remaining === 0) {
        // Back rows first so nearer rows paint in front; deterministic small
        // vertical stagger keeps the meadow natural without breaking clearance.
        const slots:FleetSlot[]=[];
        rows.reverse().flat().forEach((s,i)=>{
          let stagger=input.seed ? unit(input.seed,i)*Math.min(40,Math.max(18,(input.ground?.bottom??bottomLimit)-(input.ground?.top??bottomLimit-20))*.7) : [0,5,2,7,1,6,3,4][i%8]!;
          if(input.ground)stagger=Math.min(stagger,Math.max(0,s.y+foot-input.ground.top));
          while(stagger>0&&slots.some(p=>Math.abs(p.x-s.x)<touchW+5&&Math.abs(p.y-(s.y-stagger))<touchH+5))stagger=Math.max(0,stagger-2);
          slots.push({x:Math.round(s.x),y:Math.round(s.y-stagger)});
        });
        if(input.ground){
          const feet=slots.map(p=>p.y+body*1.82),middle=feet.reduce((a,b)=>a+b,0)/feet.length;
          const shift=(input.ground.top+input.ground.bottom)/2-middle;
          const moved=slots.map(p=>({...p,y:p.y+shift}));
          if(moved.every(p=>!obstacles.some(o=>p.x+touchW/2>o.left&&p.x-touchW/2<o.right&&p.y+foot>o.top&&p.y<o.bottom)))return{body,slots:moved};
        }
        return { body, slots };
      }
    }
  }
  return { body: Math.round(input.body * .55), slots: Array.from({ length: count }, (_, i) => ({ x: width * (i + .5) / count, y: skyTop + 20 })) };
}
function freeIntervals(y: number, foot: number, touchW: number, width: number, obstacles: Rect[]): [number, number][] {
  const half = touchW / 2 + 4;
  let free: [number, number][] = [[12 + half, width - 12 - half]];
  for (const o of obstacles) {
    if (o.bottom <= y || o.top >= y + foot) continue;
    const lo = o.left - half, hi = o.right + half;
    free = free.flatMap(([a, b]) => [[a, Math.min(b, lo)], [Math.max(a, hi), b]] as [number, number][]).filter(([a, b]) => b >= a);
  }
  return free;
}
function spread(intervals: [number, number][], capacity: number[], take: number, dx: number): number[] {
  const total = capacity.reduce((s, c) => s + c, 0);
  const ks = capacity.map(c => Math.min(c, Math.floor(take * c / total)));
  let left = take - ks.reduce((s, k) => s + k, 0);
  while (left > 0) {
    let best = -1;
    capacity.forEach((c, i) => { if (ks[i]! < c && (best < 0 || c - ks[i]! > capacity[best]! - ks[best]!)) best = i; });
    ks[best]!++; left--;
  }
  const out: number[] = [];
  intervals.forEach(([a, b], i) => {
    const k = ks[i]!; if (!k) return;
    const gap = k > 1 ? Math.min((b - a) / (k - 1), dx * 1.6) : 0, start = (a + b) / 2 - gap * (k - 1) / 2;
    for (let j = 0; j < k; j++) out.push(start + gap * j);
  });
  return out.sort((p, q) => p - q);
}


/** Map a painted landmark through the background's uniform cover/camera scale. */
export function paintedY(image: Rect, sourceY: number, position = 1, sourceWidth=1024, sourceHeight=1536): number {
  const w=image.right-image.left,h=image.bottom-image.top;
  const scale=Math.max(w/sourceWidth,h/sourceHeight);
  return image.top+(h-sourceHeight*scale)*position+sourceY*scale;
}
function unit(seed:string, id:number):number {
  let n=2166136261;for(const c of `${seed}:${id}`)n=Math.imul(n^c.charCodeAt(0),16777619);
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;return(n>>>0)/4294967296;
}
/** Stable, separated destinations: adding/removing a release never reshuffles others. */
export function layoutSky(count:number, bounds:Rect, obstacles:Rect[], seed:string, size:number, banner?:Rect):Point[] {
  const half=size/2+5,candidates:Point[]=[];
  for(let row=0;row<18;row++)for(let col=0;col<32;col++){
    const i=row*32+col;
    const x=bounds.left+half+(col+.2+unit(seed,i)*.6)/32*Math.max(0,bounds.right-bounds.left-half*2);
    const y=bounds.top+half+(row+.2+unit(seed,i+900)*.6)/18*Math.max(0,bounds.bottom-bounds.top-half*2);
    if(!obstacles.some(o=>x+half>o.left&&x-half<o.right&&y+half>o.top&&y-half<o.bottom))candidates.push({x,y});
  }
  const points:Point[]=[];
  for(let id=0;id<count;id++){
    let best=candidates[0]??{x:(bounds.left+bounds.right)/2,y:bounds.top+half},score=-Infinity;
    const above=id%2===(unit(seed,-1)>.5?0:1);
    const preferred=banner?candidates.filter(p=>above?p.y+half<banner.top:p.y-half>banner.bottom):[];
    const spacious=preferred.filter(p=>points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>size*1.15));
    const pool=spacious.length?spacious:candidates;
    for(const p of pool){
      const distance=points.length?Math.min(...points.map(q=>Math.hypot(p.x-q.x,p.y-q.y))):size*3;
      const value=distance+unit(seed,Math.round(p.x*17+p.y*31)+id*997)*size*.7;
      if(value>score){score=value;best=p;}
    }
    points.push(best);
  }
  return points;
}
