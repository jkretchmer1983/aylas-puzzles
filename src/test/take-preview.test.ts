import { describe, expect, it } from 'vitest';
import { generate } from '../gen/templates';
import { balloonCenter, emptyPlay, inReleaseZone, skyReleaseBounds, playReducer, takeClues } from '../take-preview/model';

describe('Taking Away interaction contract', () => {
  it('uses the exact seeded public task for all enabled bands and object variants', () => {
    const objects = new Set<string>();
    for (let band = 1; band <= 6; band++) for (let seed = 1; seed <= 100; seed++) {
      const spec = generate('take', band, seed), clues = takeClues(spec);
      objects.add(clues.object);
      expect(spec.kind.type).toBe('number');
      if (spec.kind.type === 'number') expect(clues.total - clues.removed).toBe(spec.kind.answer);
      if (band === 1) expect(clues.total).toBeLessThanOrEqual(8);
    }
    expect(objects).toEqual(new Set(['🎈','🍪','🧁','🍬']));
  });
  it('releases any selected quantity without inventing a correctness gate, and undo recalls the last balloon', () => {
    let state = playReducer(emptyPlay(), {type:'select',id:0});
    state = playReducer(state, {type:'select',id:1});
    state = playReducer(state, {type:'release',ids:[0,1,1,99],total:8});
    expect(state.released).toEqual([0,1]);
    expect(state.selected).toEqual([]);
    expect(state.answer).toBe('');
    state = playReducer(state, {type:'release',ids:[2],total:8});
    state = playReducer(state, {type:'undo'});
    expect(state.released).toEqual([0,1]);
    state = playReducer(state, {type:'undo'});
    expect(state.released).toEqual([0]);
    state = playReducer(state, {type:'undo'});
    expect(state.released).toEqual([]);
  });
  it('marks counting aids independently of selection and never fills the answer', () => {
    let state = playReducer(emptyPlay(), {type:'count-mode'});
    state = playReducer(state, {type:'select',id:3});
    expect(state.marked).toEqual([3]); expect(state.selected).toEqual([]); expect(state.answer).toBe('');
    state = playReducer(state, {type:'select',id:3});
    expect(state.marked).toEqual([]);
  });
  it('allows retry, keeps edits and release aids independent, and serializes for rotation/reload', () => {
    let state = playReducer(emptyPlay(), {type:'digit',digit:'4'});
    state = playReducer(state, {type:'checked',ok:false});
    expect(state.result).toBe(false);
    state = playReducer(state, {type:'erase'});
    state = playReducer(state, {type:'digit',digit:'5'});
    expect(state.result).toBe(null);
    state = playReducer(state, {type:'checked',ok:true});
    expect(state.result).toBe(true); expect(state.released).toEqual([]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
  it('targets the visible carried balloon even when the finger is below the release area', () => {
    const stage = {left:0,top:0,right:393,bottom:500};
    const zone = {left:45,top:10,right:348,bottom:65};
    const finger = {x:160,y:120};
    const center = balloonCenter(finger, stage);
    expect(center).toEqual({x:160,y:56});
    expect(inReleaseZone(center, zone)).toBe(true);
    expect(inReleaseZone(finger, zone)).toBe(false);
    expect(inReleaseZone(balloonCenter({x:160,y:350}, stage),zone)).toBe(false);
    expect(balloonCenter({x:-30,y:120},stage).x).toBe(28);
  });
});

it('accepts the displayed balloon beside and below the banner while excluding the meadow',()=>{
  const scene={left:0,top:0,right:393,bottom:852},banner={left:10,top:56,right:383,bottom:156};
  const zone=skyReleaseBounds(scene,banner);
  expect(inReleaseZone({x:30,y:40},zone,0)).toBe(true);
  expect(inReleaseZone({x:30,y:100},zone,0)).toBe(true);
  expect(inReleaseZone({x:365,y:240},zone,0)).toBe(true);
  expect(inReleaseZone(balloonCenter({x:365,y:304},scene),zone,0)).toBe(true);
  expect(inReleaseZone({x:160,y:360},zone,0)).toBe(false);
});

import { layoutFleet } from '../take-preview/model';
describe('layoutFleet', () => {
  const hit = (a: {left:number;top:number;right:number;bottom:number}, b: typeof a) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const boxes = (l: ReturnType<typeof layoutFleet>) => l.slots.map(s => ({ left: s.x - Math.max(l.body,48)/2, right: s.x + Math.max(l.body,48)/2, top: s.y, bottom: s.y + l.body * 2.12 }));
  it('keeps eight portrait balloons low, separate and clear of the suitcase and girl', () => {
    const suitcase = { left: 72, top: 598, right: 748, bottom: 896 }, girl = { left: 0, top: 425, right: 221, bottom: 738 };
    const l = layoutFleet({ count: 8, width: 820, height: 1000, skyTop: 148, obstacles: [suitcase, girl], body: 72, portrait: true });
    const b = boxes(l);
    expect(b).toHaveLength(8);
    b.forEach((x, i) => { expect(hit(x, suitcase)).toBe(false); expect(hit(x, girl)).toBe(false); b.slice(i + 1).forEach(y => expect(hit({ ...x, bottom: x.top + Math.max(l.body*1.3,62) }, { ...y, bottom: y.top + Math.max(l.body*1.3,62) })).toBe(false)); });
    expect(Math.min(...b.map(x => x.top))).toBeGreaterThan(148 + 140);
  });
});

