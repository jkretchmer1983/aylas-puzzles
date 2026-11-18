import type { Rng } from '../rng';
import type { PuzzleSpec } from '../types';
import { bindContent } from '@/lib/content-binding';

export type AirShape = 'circle' | 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon' | 'octagon';
export type Point = { x: number; y: number };
export const SHAPES: Record<AirShape, { sides: number; corners: number; points: Point[] }> = {
  circle: { sides: 0, corners: 0, points: [] },
  triangle: polygon(3), square: { sides: 4, corners: 4, points: [{x:20,y:20},{x:80,y:20},{x:80,y:80},{x:20,y:80}] },
  rectangle: { sides:4,corners:4,points:[{x:10,y:30},{x:90,y:30},{x:90,y:70},{x:10,y:70}] },
  pentagon: polygon(5), hexagon: polygon(6), octagon: polygon(8),
};
function polygon(n: number) { return { sides:n, corners:n, points:Array.from({length:n},(_,i)=>({x:50+40*Math.cos(i*2*Math.PI/n-Math.PI/2),y:50+40*Math.sin(i*2*Math.PI/n-Math.PI/2)})) }; }
export type AirPiece = { shape: AirShape; color: 'red' | 'blue' | 'green' | 'gold'; rotation: number };
export type AirshipData = { pieces: AirPiece[]; query: { type:'name' | 'sides' | 'corners'; value: string | number }; contentSeed: number };
export function matches(piece: AirPiece, query: AirshipData['query']) { return query.type === 'name' ? piece.shape === query.value : SHAPES[piece.shape][query.type] === query.value; }
export function rotatedPoints(piece: AirPiece) { const a=piece.rotation*Math.PI/180; return SHAPES[piece.shape].points.map(p=>({x:50+(p.x-50)*Math.cos(a)-(p.y-50)*Math.sin(a),y:50+(p.x-50)*Math.sin(a)+(p.y-50)*Math.cos(a)})); }
export function makeAirshipPuzzle(r: Rng, band: number): PuzzleSpec {
  const pool: AirShape[] = band === 1 ? ['circle','triangle','square','rectangle'] : band === 2 ? ['circle','triangle','square','rectangle','pentagon','hexagon'] : Object.keys(SHAPES) as AirShape[];
  const target=r.pick(pool);
  const type=band === 1 ? 'name' : r.pick(['name','sides','corners'] as const);
  const query: AirshipData['query']={type,value:type==='name'?target:SHAPES[target][type]};
  const names=r.shuffle([target,...r.shuffle(pool.filter(shape=>!matches({shape,color:'gold',rotation:0},query))).slice(0,3)]);
  const colors=r.shuffle(['red','blue','green','gold'] as const);
  const pieces=names.map((shape,i)=>({shape,color:colors[i] ?? 'gold',rotation:r.int(-40,40)}));
  const answer=pieces.findIndex(p=>matches(p,query));
  const contentSeed=r.int(1,2147483646);const binding=bindContent(contentSeed);
  const task=type==='name'?`Find the ${target}.`:query.value===0?`Find the shape with no ${type==='sides'?'straight sides':'corners'}.`:`Find the shape with ${query.value} ${type==='sides'?'straight sides':'corners'}.`;
  return {template:'shapepick',title:binding.title,story:binding.story,task,hint:'Look around each boundary. Turning a shape does not change its sides or corners.',theme:`Workshop airship mission: ${binding.mission}. Pip the mechanical bird. ${binding.prop}. Wooden geometric fittings retain their exact shapes.`,scene:[],kind:{type:'choice',options:names,answer},airship:{pieces,query,contentSeed}};
}
export type TraceProgress = Record<number, number[]>;
export function traceSample(piece: AirPiece, point: Point, progress: TraceProgress): { progress:TraceProgress; completed:number[]; light:Point | null } {
  const points=rotatedPoints(piece);let edge=-1,t=0,light:Point|null=null,distance=14;
  if(piece.shape==='circle'){
    const dx=point.x-50,dy=point.y-50,length=Math.hypot(dx,dy);
    if(Math.abs(length-40)<=14&&length>0){edge=0;t=(Math.atan2(dy,dx)+Math.PI)/(2*Math.PI);light={x:50+40*dx/length,y:50+40*dy/length};}
  } else points.forEach((a,i)=>{const b=points[(i+1)%points.length];if(!b)return;const dx=b.x-a.x,dy=b.y-a.y;const u=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));const q={x:a.x+dx*u,y:a.y+dy*u};const d=Math.hypot(point.x-q.x,point.y-q.y);if(d<distance){distance=d;edge=i;t=u;light=q;}});
  if(edge<0)return {progress,completed:completedEdges(progress),light:null};
  const bins=new Set(progress[edge]??[]);bins.add(Math.min(9,Math.floor(t*10)));
  const next={...progress,[edge]:[...bins]};return {progress:next,completed:completedEdges(next),light};
}
export function completedEdges(progress:TraceProgress){return Object.keys(progress).map(Number).filter(i=>(progress[i]?.length??0)>=7);}