import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { generate } from '../gen/templates';
import { TakePreviewPuzzle } from '../gen/Renderer';
import { emptyPlay } from '../take-preview/model';

function Harness() {
  const [play, onPlayChange] = useState(emptyPlay);
  const spec = generate('take',1,1);
  return <TakePreviewPuzzle spec={spec} play={play} onPlayChange={onPlayChange} reduced={true} sessionKey="test" onAnnounce={()=>{}} onNext={()=>{}} onPrevious={()=>{}} previousDisabled={true} onNew={()=>{}} onStory={()=>{}} onHint={()=>{}} hintOpen={false} />;
}
afterEach(cleanup);
describe('Taking Away rendered interaction', () => {
  it('supports tap selection, release, undo, and numeric validation through Renderer', () => {
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
    expect(screen.getByText('Correct! Ready for another?')).toBeTruthy();
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
    act(() => { vi.advanceTimersByTime(350); });
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
