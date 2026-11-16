/** Back-compat shim: forest effects now route through the shared mixer's forest profile. */
import { playEffect, setAudioSettings } from './audio/mixer';
export type ForestSound = 'tap' | 'carve' | 'grow' | 'correct' | 'retry';
const MAP = { tap: 'action', carve: 'place', grow: 'begin', correct: 'success', retry: 'retry' } as const;
export function setForestSoundEnabled(value: boolean) { setAudioSettings({ effects: value }); }
export function playForestSound(kind: ForestSound) { if (typeof window === 'undefined') return; playEffect('forest', MAP[kind]); }
