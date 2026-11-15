import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    const first = screen.getAllByRole('button').find(b => b.hasAttribute('data-balloon-id'))!;
    const label = first.getAttribute('aria-label')!;
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button',{name:'Release 1',exact:true}));
    expect(screen.queryByRole('button',{name:label,exact:true})).toBeNull();
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button',{name:'Undo',exact:true}));
    expect(screen.getByRole('button',{name:label,exact:true})).toBeTruthy();
    const spec = generate('take',1,1);
    if (spec.kind.type !== 'number') throw new Error('expected number');
    for (const d of String(spec.kind.answer)) fireEvent.click(screen.getByRole('button',{name:d,exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Check my answer',exact:true}));
    expect(screen.getByText('Correct! Ready for another?')).toBeTruthy();
  });
  it('cancels an in-progress drag on rotation without changing released or entered state', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const first = screen.getAllByRole('button').find(b => b.hasAttribute('data-balloon-id'))!;
    first.setPointerCapture = vi.fn(); first.hasPointerCapture = vi.fn(()=>false);
    // jsdom lacks native PointerEvent; define it for the gesture, not for production code.
    const down = new Event('pointerdown',{bubbles:true});
    Object.assign(down,{pointerId:1,isPrimary:true,button:0,clientX:100,clientY:250});
    fireEvent(first,down);
    vi.advanceTimersByTime(350);
    fireEvent(window,new Event('orientationchange'));
    expect(screen.getAllByRole('button').filter(b=>b.hasAttribute('data-balloon-id')).length).toBe(takeCount());
    expect(screen.getByRole('button',{name:'Undo',exact:true}).hasAttribute('disabled')).toBe(true);
    vi.useRealTimers();
  });
});
function takeCount(){ return Number(/There were (\d+)/.exec(generate('take',1,1).task)![1]); }
