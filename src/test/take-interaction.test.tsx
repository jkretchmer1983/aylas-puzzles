import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { generate } from '../gen/templates';
import { TakePreviewPuzzle } from '../gen/Renderer';
import { emptyPlay } from '../take-preview/model';

function Harness({reduced=true}:{reduced?:boolean}) {
  const [play, onPlayChange] = useState(emptyPlay);
  const spec = generate('take',1,1);
  return <TakePreviewPuzzle spec={spec} play={play} onPlayChange={onPlayChange} reduced={reduced} sessionKey="test" onAnnounce={()=>{}} onNext={()=>{}} onPrevious={()=>{}} previousDisabled={true} onNew={()=>{}} onStory={()=>{}} onHint={()=>{}} hintOpen={false} />;
}
afterEach(cleanup);
describe('Taking Away rendered interaction', () => {
  it('supports tap selection, release, undo, and numeric validation through Renderer', async () => {
    render(<Harness />);
    const first = screen.getAllByRole('button').find(b => b.hasAttribute('data-balloon-id'));
    if (!first) throw new Error('Missing balloon');
    const label = first.getAttribute('aria-label');
    if (!label) throw new Error('Missing balloon label');
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button',{name:'Release 1'}));
    expect(screen.queryByRole('button',{name:label})).toBeNull();
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button',{name:'Undo'}));
    expect(screen.getByRole('button',{name:label})).toBeTruthy();
    const spec = generate('take',1,1);
    if (spec.kind.type !== 'number') throw new Error('expected number');
    for (const d of String(spec.kind.answer)) fireEvent.click(screen.getByRole('button',{name:d}));
    fireEvent.click(screen.getByRole('button',{name:'Check my answer'}));
    expect(await screen.findByText('Correct! Ready for another?')).toBeTruthy();
  });
  it('cancels an in-progress drag on rotation without changing released or entered state', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const first = screen.getAllByRole('button').find(b => b.hasAttribute('data-balloon-id'));
    if (!first) throw new Error('Missing balloon');
    first.setPointerCapture = vi.fn(); first.hasPointerCapture = vi.fn(()=>false);
    // jsdom lacks native PointerEvent; define it for the gesture, not for production code.
    const down = new Event('pointerdown',{bubbles:true});
    Object.assign(down,{pointerId:1,isPrimary:true,button:0,clientX:100,clientY:250});
    fireEvent(first,down);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent(window,new Event('orientationchange'));
    expect(screen.getAllByRole('button').filter(b=>b.hasAttribute('data-balloon-id')).length).toBe(takeCount());
    expect(screen.getByRole('button',{name:'Undo'}).hasAttribute('disabled')).toBe(true);
    vi.useRealTimers();
  });
});
function takeCount(){
  const match = /There were (\d+)/.exec(generate('take',1,1).task);
  if (!match) throw new Error('Missing public count');
  return Number(match[1]);
}


describe('physical balloon scene feedback and pointer behavior',()=>{
  it('turns the same check control into Try again without resetting the answer or balloons',()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole('button',{name:'0'}));
    const check=screen.getByRole('button',{name:'Check my answer'});
    fireEvent.click(check);
    expect(screen.getByRole('button',{name:'Try again'})).toBe(check);
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('0');
    const before=screen.getAllByRole('button').filter(b=>b.hasAttribute('data-balloon-id')).length;
    fireEvent.click(check);
    expect(screen.getByRole('button',{name:'Check my answer'})).toBe(check);
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('0');
    expect(screen.getAllByRole('button').filter(b=>b.hasAttribute('data-balloon-id')).length).toBe(before);
    fireEvent.click(screen.getByRole('button',{name:'5'}));
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('5');
  });
  it('recalls only the most recent balloon while release animations are running',()=>{
    const {container}=render(<Harness reduced={false}/>);
    const balloons=screen.getAllByRole('button').filter(b=>b.hasAttribute('data-balloon-id'));
    fireEvent.click(balloons[0]!);fireEvent.click(balloons[1]!);
    fireEvent.click(screen.getByRole('button',{name:'Release 2'}));
    expect(container.querySelectorAll('.take-flight').length).toBe(2);
    fireEvent.click(screen.getByRole('button',{name:'Undo'}));
    expect(container.querySelectorAll('.take-flight').length).toBe(1);
    expect(container.querySelectorAll('[data-balloon-id]').length).toBe(balloons.length-1);
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('');
  });
  it('uses the displayed balloon offset for a valid release, ignores duplicates, and preserves count through rotation',()=>{
    const {container}=render(<Harness/>);
    const stage=container.querySelector('.take-airfield') as HTMLElement;
    const zone=container.querySelector('.take-launch') as HTMLElement;
    stage.getBoundingClientRect=()=>({left:0,top:0,right:393,bottom:500,width:393,height:500,x:0,y:0,toJSON:()=>({})});
    zone.getBoundingClientRect=()=>({left:45,top:10,right:348,bottom:65,width:303,height:55,x:45,y:10,toJSON:()=>({})});
    const first=container.querySelector('[data-balloon-id]') as HTMLButtonElement;
    first.setPointerCapture=vi.fn();first.hasPointerCapture=()=>false;
    const point=(type:string,x:number,y:number)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});fireEvent(first,event)};
    point('pointerdown',100,300);point('pointermove',160,120);
    const carried=container.querySelector('.take-carried') as HTMLElement;
    expect(carried.style.top).toBe('56px');
    point('pointerup',160,120);point('pointerup',160,120);
    expect(container.querySelectorAll('[data-balloon-id]').length).toBe(takeCount()-1);
    fireEvent.click(screen.getByRole('button',{name:'3'}));
    fireEvent(window,new Event('orientationchange'));
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('3');
    expect(container.querySelectorAll('[data-balloon-id]').length).toBe(takeCount()-1);
  });
  it('returns an invalid drop without releasing or changing the numeric answer',()=>{
    const {container}=render(<Harness/>);
    const stage=container.querySelector('.take-airfield') as HTMLElement;
    const zone=container.querySelector('.take-launch') as HTMLElement;
    stage.getBoundingClientRect=()=>({left:0,top:0,right:393,bottom:500,width:393,height:500,x:0,y:0,toJSON:()=>({})});
    zone.getBoundingClientRect=()=>({left:45,top:10,right:348,bottom:65,width:303,height:55,x:45,y:10,toJSON:()=>({})});
    const first=container.querySelector('[data-balloon-id]') as HTMLButtonElement;
    first.setPointerCapture=vi.fn();first.hasPointerCapture=()=>false;
    for(const [type,y] of [['pointerdown',300],['pointermove',350],['pointerup',350]] as const){const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,isPrimary:true,button:0,clientX:160,clientY:y});fireEvent(first,e)}
    expect(container.querySelectorAll('[data-balloon-id]').length).toBe(takeCount());
    expect(screen.getByRole('button',{name:'Undo'}).hasAttribute('disabled')).toBe(true);
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('');
  });
});
