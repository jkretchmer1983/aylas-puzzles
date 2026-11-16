import type { PuzzleSpec } from '../gen/types';

/** Read only public task data. No answers enter the scene model. */
export function takeClues(spec: Pick<PuzzleSpec, 'template' | 'task'>) {
  if (spec.template !== 'take') throw new Error('Taking Away requires a take puzzle');
  const match = /^There were (\d+) (.+)\. (\d+) were taken\. How many are left\?$/.exec(spec.task);
  if (!match) throw new Error('Unsupported Taking Away task; keep the original renderer');
  const total = Number(match[1]), removed = Number(match[3]);
  if (total < 1 || removed < 1 || removed >= total) throw new Error('Invalid public task');
  const object = match[2];
  if (!object) throw new Error('Missing Taking Away object');
  return { total, removed, object, balloon: object === '🎈' };
}
export type PlayState = {
  selected: number[]; released: number[]; batches: number[][];
  marked: number[]; countMode: boolean; answer: string; result: boolean | null;
};
export const emptyPlay = (): PlayState => ({ selected: [], released: [], batches: [], marked: [], countMode: false, answer: '', result: null });
export type PlayAction =
  | { type: 'select'; id: number }
  | { type: 'release'; ids: number[]; total: number }
  | { type: 'undo' } | { type: 'count-mode' }
  | { type: 'digit'; digit: string; replace?: boolean } | { type: 'erase' }
  | { type: 'checked'; ok: boolean } | { type: 'retry' };
export function playReducer(s: PlayState, a: PlayAction): PlayState {
  switch (a.type) {
    case 'select': {
      if (s.released.includes(a.id)) return s;
      const key = s.countMode ? 'marked' : 'selected';
      return { ...s, [key]: s[key].includes(a.id) ? s[key].filter(id => id !== a.id) : [...s[key], a.id], result: null };
    }
    case 'release': {
      const ids = [...new Set(a.ids)].filter(id => Number.isInteger(id) && id >= 0 && id < a.total && !s.released.includes(id));
      if (!ids.length) return s;
      return { ...s, released: [...s.released, ...ids], selected: s.selected.filter(id => !ids.includes(id)), marked: s.marked.filter(id => !ids.includes(id)), batches: [...s.batches, ids], result: null };
    }
    case 'undo': {
      const last = s.released.at(-1);
      if (last === undefined) return s;
      return { ...s, released: s.released.slice(0,-1), batches: s.batches.map(batch => batch.filter(id => id !== last)).filter(batch => batch.length), result: null };
    }
    case 'count-mode': return { ...s, countMode: !s.countMode, selected: [] };
    case 'digit': return /^\d$/.test(a.digit) ? { ...s, answer: ((a.replace?'':s.answer) + a.digit).slice(0, 4), result: null } : s;
    case 'erase': return { ...s, answer: s.answer.slice(0, -1), result: null };
    case 'retry': return { ...s, result: null };
    case 'checked': return s.answer ? { ...s, result: a.ok } : s;
  }
}
export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };
/** Hit testing uses the carried balloon's displayed center, never the raw finger. */
export function balloonCenter(finger: Point, stage: Rect): Point {
  return { x: Math.max(stage.left + 28, Math.min(stage.right - 28, finger.x)), y: Math.max(stage.top + 34, Math.min(stage.bottom - 40, finger.y - 64)) };
}
export function inReleaseZone(center: Point, zone: Rect, tolerance = 12) {
  return center.x >= zone.left - tolerance && center.x <= zone.right + tolerance && center.y >= zone.top - tolerance && center.y <= zone.bottom + tolerance;
}
