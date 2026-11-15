import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PuzzleBody } from '@/gen/Renderer';
import { generate } from '@/gen/templates';
import { playForestSound, setForestSoundEnabled } from '@/lib/forest-audio';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); setForestSoundEnabled(true); });

describe('forest motion preserves puzzle state', () => {
  it('carves only the newly edited value and retains the generator-owned answer', () => {
    const spec=generate('sudoku',4,12345), report=vi.fn();
    if(spec.kind.type!=='sudoku') throw new Error('Expected Sudoku');
    const k=spec.kind;
    const {container}=render(<PuzzleBody spec={spec} report={report}/>);
    expect(container.querySelectorAll('.engraving-in-progress')).toHaveLength(0);
    const open=k.given.findIndex(x=>x===null);
    fireEvent.click(screen.getByLabelText(`Row ${Math.floor(open/4)+1}, column ${open%4+1}, empty`));
    fireEvent.click(screen.getByRole('button',{name:k.symbols[k.solution[open]],exact:true}));
    expect(container.querySelectorAll('.engraving-in-progress')).toHaveLength(1);
    expect(container.querySelectorAll('.pz-sudoku-fixed .engraving-in-progress')).toHaveLength(0);
    expect(report).not.toHaveBeenCalled();
    k.given.forEach((given,i)=>{
      if(given!==null||i===open)return;
      fireEvent.click(screen.getByLabelText(`Row ${Math.floor(i/4)+1}, column ${i%4+1}, empty`));
      fireEvent.click(screen.getByRole('button',{name:k.symbols[k.solution[i]],exact:true}));
    });
    fireEvent.click(screen.getByRole('button',{name:'Check my answer ✓'}));
    expect(report).toHaveBeenCalledWith(true);
  });
});

describe('forest sound fallback', () => {
  it('creates no audio context while muted', () => {
    const audio=vi.fn(); vi.stubGlobal('AudioContext',audio);
    setForestSoundEnabled(false);playForestSound('carve');playForestSound('correct');
    expect(audio).not.toHaveBeenCalled();
  });
  it('keeps gameplay available when audio is unsupported or blocked', () => {
    vi.stubGlobal('AudioContext',undefined);
    expect(()=>playForestSound('tap')).not.toThrow();
    vi.stubGlobal('AudioContext',class { constructor(){ throw new Error('Audio blocked'); } });
    expect(()=>playForestSound('grow')).not.toThrow();
  });
});
