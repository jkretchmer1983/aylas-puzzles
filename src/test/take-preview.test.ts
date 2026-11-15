import { describe, expect, it } from 'vitest';
import { generate } from '../gen/templates';
import { balloonCenter, emptyPlay, inReleaseZone, playReducer, takeClues } from '../take-preview/model';

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
  it('releases any selected quantity without inventing a correctness gate, and undo recalls a batch', () => {
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
    expect(center).toEqual({x:160,y:46});
    expect(inReleaseZone(center, zone)).toBe(true);
    expect(inReleaseZone(finger, zone)).toBe(false);
    expect(inReleaseZone(balloonCenter({x:160,y:350}, stage),zone)).toBe(false);
    expect(balloonCenter({x:-30,y:120},stage).x).toBe(28);
  });
});
