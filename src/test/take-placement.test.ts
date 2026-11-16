import {describe,it,expect} from 'vitest';
import {layoutSky,layoutFleet,paintedY} from '../take-preview/model';
describe('balloon sky and painted meadow registration',()=>{
 it('keeps eight random destinations in sky, apart and clear of the banner and controls',()=>{
  const bounds={left:8,top:4,right:812,bottom:310};
  const obstacles=[{left:170,top:78,right:650,bottom:205},{left:12,top:8,right:210,bottom:60},{left:670,top:8,right:812,bottom:60}];
  for(let seed=0;seed<24;seed++){
   const points=layoutSky(8,bounds,obstacles,String(seed),32);
   expect(points).toEqual(layoutSky(8,bounds,obstacles,String(seed),32));
   expect(points.slice(0,3)).toEqual(layoutSky(3,bounds,obstacles,String(seed),32));
   for(const [i,p] of points.entries()){
    expect(p.y-16).toBeGreaterThanOrEqual(bounds.top);expect(p.y+16).toBeLessThan(bounds.bottom);
    expect(p.x-16).toBeGreaterThan(bounds.left);expect(p.x+16).toBeLessThan(bounds.right);
    expect(obstacles.some(o=>p.x+16>o.left&&p.x-16<o.right&&p.y+16>o.top&&p.y-16<o.bottom)).toBe(false);
    points.slice(i+1).forEach(q=>expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeGreaterThan(40));
   }
  }
  expect(layoutSky(8,bounds,obstacles,'new',32)).not.toEqual(layoutSky(8,bounds,obstacles,'old',32));
 });
 it('places anchor footprints within the chosen central grass band, with stable varied heights',()=>{
  const input={count:8,width:820,height:1180,skyTop:150,obstacles:[{left:0,top:680,right:205,bottom:1000},{left:90,top:800,right:730,bottom:1100}],body:72,portrait:true,ground:{top:540,bottom:770},seed:'test-seed'};
  const l=layoutFleet(input);expect(l.slots).toHaveLength(8);
  expect(l).toEqual(layoutFleet(input));
  l.slots.forEach((p,i)=>{
   expect(p.y+l.body*1.82).toBeGreaterThanOrEqual(input.ground.top-1);
   expect(p.y+l.body*1.82).toBeLessThanOrEqual(input.ground.bottom+1);
   l.slots.slice(i+1).forEach(q=>expect(Math.abs(q.x-p.x)>=Math.max(l.body,48)||Math.abs(q.y-p.y)>=Math.max(l.body*1.3,62)).toBe(true));
  });
  expect(new Set(l.slots.map(p=>p.y)).size).toBeGreaterThan(3);
 });
 it('keeps the largest fleet on the short-landscape grass rather than falling back into the sky',()=>{
  const l=layoutFleet({count:8,width:852,height:393,skyTop:90,body:44,portrait:false,ground:{top:250,bottom:325},seed:'short',obstacles:[{left:420,top:145,right:857,bottom:341},{left:0,top:240,right:100,bottom:375},{left:0,top:90,right:128,bottom:393},{left:425,top:332,right:852,bottom:393}]});
  expect(l.body).toBeGreaterThan(30);
  l.slots.forEach(p=>{expect(p.y+l.body*1.82).toBeGreaterThan(230);expect(p.y+l.body*1.82).toBeLessThan(345);});
 });
 it('maps scene landmarks through cover cropping and uniform camera scaling',()=>{
  expect(paintedY({left:0,top:0,right:1024,bottom:1536},900)).toBe(900);
  expect(paintedY({left:-153.6,top:-460.8,right:1177.6,bottom:1536},900)).toBeCloseTo(709.2);
 });
});
