import { generate } from '../gen/templates';
import { newSeed } from '../gen/rng';
import { takeClues } from './model';

/** Compare arithmetic, not the emoji/title, so a changed noun cannot mask a repeat. */
export function takeNumberKey(seed: number): string {
  const { total, removed } = takeClues(generate('take', 1, seed));
  return `${total}-${removed}`;
}

/** Select another existing generated puzzle; never rewrite its facts or answer. */
export function freshTakeSeed(recent: readonly number[] = [], object?: string, entropy = newSeed()): number {
  const excluded = new Set(recent.slice(-4).map(takeNumberKey));
  const start = Math.abs(Math.trunc(entropy)) % 2 ** 31;
  // A bounded deterministic fallback also handles a repeated random draw.
  for (let attempt = 0; attempt < 4096; attempt++) {
    const seed = (start + attempt * 104729) % 2 ** 31;
    const clues = takeClues(generate('take', 1, seed));
    if ((!object || clues.object === object) && !excluded.has(`${clues.total}-${clues.removed}`)) return seed;
  }
  throw new Error('Could not select a fresh Taking Away puzzle');
}
