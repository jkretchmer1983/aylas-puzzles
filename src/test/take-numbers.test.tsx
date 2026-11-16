import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../gen/templates';
import { takeClues } from '../take-preview/model';
import { freshTakeSeed, takeNumberKey } from '../take-preview/numbers';
import { TakePreview } from '../take-preview/TakePreview';

vi.mock('../gen/rng',async()=>({...await vi.importActual('../gen/rng'),newSeed:()=>42}));
vi.mock('../lib/story-cache',()=>({ensureStory:(_key:string,input:{title:string;story:string})=>({settled:true,title:input.title,story:input.story}),subscribeStory:()=>()=>{}}));
beforeEach(()=>{
  sessionStorage.clear();localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const task=()=>screen.getByRole('region',{name:'Instructions'}).querySelector('p')!.textContent!;
const pair=()=>task().match(/\d+/g)!.slice(0,2).join('-');
const object=()=>takeClues({template:'take',task:task()}).object;

describe('fresh Taking Away numbers',()=>{
  it('avoids the last four arithmetic pairs even with constant random entropy',()=>{
    const recent:number[]=[];const totals=new Set<number>(),removals=new Set<number>();
    for(let i=0;i<60;i++){
      const seed=freshTakeSeed(recent,undefined,42);
      expect(recent.slice(-4).map(takeNumberKey)).not.toContain(takeNumberKey(seed));
      const spec=generate('take',1,seed),clues=takeClues(spec);
      expect(spec.kind.type).toBe('number');
      if(spec.kind.type==='number')expect(spec.kind.answer).toBe(clues.total-clues.removed);
      expect(generate('take',1,seed)).toEqual(spec);
      totals.add(clues.total);removals.add(clues.removed);recent.push(seed);
    }
    expect(totals.size).toBeGreaterThan(2);expect(removals.size).toBeGreaterThan(2);
  });
  it('changes numbers on New while preserving the current subject and staying in gameplay',()=>{
    render(<TakePreview/>);fireEvent.click(screen.getByRole('button',{name:'Let’s fly'}));
    const subject=object();const previous:string[]=[];
    for(let i=0;i<8;i++){
      previous.push(pair());fireEvent.click(screen.getByRole('button',{name:'New'}));
      expect(previous.slice(-4)).not.toContain(pair());expect(object()).toBe(subject);
      expect(screen.queryByRole('button',{name:'Let’s fly'})).toBeNull();
    }
  });
  it('Next varies arithmetic, while Previous, forward history, rotation and refresh preserve work',()=>{
    const first=render(<TakePreview/>);fireEvent.click(screen.getByRole('button',{name:'Let’s fly'}));
    const original=pair();fireEvent.click(screen.getByRole('button',{name:'2'}));
    fireEvent.click(screen.getByRole('button',{name:/Next/}));
    const second=pair();expect(second).not.toBe(original);
    fireEvent.click(screen.getByRole('button',{name:'Let’s fly'}));
    fireEvent.click(screen.getByRole('button',{name:'Previous puzzle'}));
    expect(pair()).toBe(original);expect(screen.getByLabelText('Your answer')).toHaveValue('2');
    act(()=>window.dispatchEvent(new Event('orientationchange')));
    expect(pair()).toBe(original);expect(screen.getByLabelText('Your answer')).toHaveValue('2');
    first.unmount();render(<TakePreview/>);
    expect(pair()).toBe(original);expect(screen.getByLabelText('Your answer')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button',{name:/Next/}));expect(pair()).toBe(second);
  });
  it('fresh launches vary numbers rather than restarting the reference example',()=>{
    const a=render(<TakePreview/>),first=pair();a.unmount();sessionStorage.clear();
    render(<TakePreview/>);expect(pair()).not.toBe(first);
  });
});
