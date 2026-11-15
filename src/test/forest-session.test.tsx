import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { readPuzzleSession, savePuzzleSession } from '@/lib/puzzle-session';
import { ReadAloud } from '@/components/ReadAloud';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('forest adventure session', () => {
  it('keeps entered cells when opening/starting the same story, isolated from new puzzles', () => {
    const key = 'story-roundtrip';
    savePuzzleSession(key, { cells: [null, 2, 1, 3] });
    savePuzzleSession(key, { started: true });
    expect(readPuzzleSession(key)).toEqual({ cells: [null, 2, 1, 3], started: true });
    expect(readPuzzleSession('another-adventure')).toEqual({});
  });
});
describe('read aloud', () => {
  it('speaks exact task text, allows stop, and cancels speech on unmount', () => {
    const synth = { speak: vi.fn(), cancel: vi.fn() };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const { unmount } = render(<ReadAloud text="Each row needs one of each." />);
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(synth.speak.mock.calls[0]?.[0].text).toBe('Each row needs one of each.');
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading instructions' }));
    expect(synth.cancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    const calls = synth.cancel.mock.calls.length;
    unmount();
    expect(synth.cancel.mock.calls.length).toBe(calls + 1);
  });
  it('keeps an unavailable speech control disabled', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    // The property can exist but be unavailable in some browser shells.
    render(<ReadAloud text="Task" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Sudoku check emphasis', () => {
  it('drops ready emphasis after a wrong check and restores it only for a changed answer', async () => {
    const { PuzzleBody } = await import('@/gen/Renderer');
    const { generate } = await import('@/gen/templates');
    const spec = generate('sudoku', 4, 12345);
    if (spec.kind.type !== 'sudoku') throw new Error('Expected Sudoku');
    const k = spec.kind, report = vi.fn();
    render(<PuzzleBody spec={spec} report={report} />);
    k.given.forEach((given, i) => {
      if (given !== null) return;
      fireEvent.click(screen.getByLabelText(`Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}, empty`));
      fireEvent.click(screen.getByRole('button', { name: k.symbols[0] }));
    });
    const check = screen.getByRole('button', { name: 'Check my answer ✓' });
    expect(check.parentElement).toHaveClass('pz-check-ready');
    fireEvent.click(check);
    expect(report).toHaveBeenCalledWith(false);
    expect(check.parentElement).not.toHaveClass('pz-check-ready');
    fireEvent.click(screen.getByRole('button', { name: k.symbols[0] }));
    expect(check.parentElement).not.toHaveClass('pz-check-ready');
    fireEvent.click(screen.getByRole('button', { name: k.symbols[1] }));
    expect(check.parentElement).toHaveClass('pz-check-ready');
  });
});
