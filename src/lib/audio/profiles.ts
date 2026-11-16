/** Registry of scene audio profiles. Every game adapter MUST map to a profile here (see AUDIO.md). */
export type Wave = OscillatorType;
export interface MusicProfile {
  bpm: number;
  /** Root frequency in Hz and scale steps in semitones. */
  root: number; scale: number[];
  /** Chord roots as scale degrees, one per bar. */
  chords: number[];
  /** 8-step melody per bar: scale degree, or null for rest. */
  melody: (number | null)[];
  lead: Wave; pad: Wave; bass: Wave;
  /** 8-step percussion: 'k' soft knock, 't' tick, 's' shaker, '.' rest. */
  drums: string;
  leadOctave: number; swing?: number;
}
export interface EffectVoice { wave: Wave | 'noise'; notes: number[]; step: number; dur: number; vol: number; filter?: number; glide?: number }
export interface AudioProfile {
  id: string; label: string; instruments: string;
  music: MusicProfile;
  effects: { action: EffectVoice; place: EffectVoice; success: EffectVoice; retry: EffectVoice; begin: EffectVoice };
}
const major = [0, 2, 4, 5, 7, 9, 11], minorPent = [0, 3, 5, 7, 10], majorPent = [0, 2, 4, 7, 9], dorian = [0, 2, 3, 5, 7, 9, 10], lydian = [0, 2, 4, 6, 7, 9, 11];
const fx = (wave: EffectVoice['wave'], notes: number[], step: number, dur: number, vol: number, extra: Partial<EffectVoice> = {}): EffectVoice => ({ wave, notes, step, dur, vol, ...extra });

export const AUDIO_PROFILES = {
  forest: { id: 'forest', label: 'Forest Sudoku', instruments: 'wooden marimba, soft flute, plucked bass, bark knocks',
    music: { bpm: 84, root: 196, scale: majorPent, chords: [0, 3, 4, 2], melody: [4, null, 2, 3, null, 1, 0, null], lead: 'triangle', pad: 'sine', bass: 'triangle', drums: 'k..t.k..', leadOctave: 2 },
    effects: { action: fx('triangle', [880], 0, .08, .05), place: fx('noise', [1400], 0, .3, .05, { filter: 1400 }), success: fx('triangle', [523, 659, 784, 1047], .09, .3, .05), retry: fx('triangle', [330, 262], .12, .2, .04), begin: fx('sine', [196, 294, 392], .15, .45, .03) } },
  tree: { id: 'tree', label: 'Treehouse', instruments: 'kalimba, hand drum, ocarina',
    music: { bpm: 96, root: 220, scale: major, chords: [0, 5, 3, 4], melody: [0, 2, 4, null, 5, 4, 2, null], lead: 'sine', pad: 'triangle', bass: 'sine', drums: 'k.t.k.tt', leadOctave: 2 },
    effects: { action: fx('sine', [988], 0, .07, .05), place: fx('triangle', [660, 880], .05, .12, .05), success: fx('sine', [587, 740, 880, 1175], .08, .35, .05), retry: fx('sine', [392, 330], .13, .2, .04), begin: fx('sine', [440, 554, 659], .1, .3, .03) } },
  river: { id: 'river', label: 'River stones', instruments: 'water-drop bells, rippling harp, low reed',
    music: { bpm: 72, root: 174.6, scale: lydian, chords: [0, 1, 0, 4], melody: [4, 6, null, 7, null, 4, 2, null], lead: 'sine', pad: 'sine', bass: 'triangle', drums: 's...s.s.', leadOctave: 2, swing: .12 },
    effects: { action: fx('sine', [1200], 0, .09, .05, { glide: 1.6 }), place: fx('sine', [520, 780], .04, .18, .05, { glide: .7 }), success: fx('sine', [698, 880, 1047, 1397], .1, .5, .045), retry: fx('sine', [440, 349], .14, .25, .04, { glide: .8 }), begin: fx('sine', [349, 523, 698], .12, .5, .03) } },
  workshop: { id: 'workshop', label: 'Inventor workshop', instruments: 'square-wave clockwork, bouncy bass, gear clicks',
    music: { bpm: 112, root: 233, scale: dorian, chords: [0, 3, 4, 0], melody: [0, 2, 0, 4, 3, null, 2, 1], lead: 'square', pad: 'triangle', bass: 'sawtooth', drums: 'kttkt.tt', leadOctave: 1 },
    effects: { action: fx('square', [1500], 0, .04, .03), place: fx('noise', [3000], 0, .06, .05, { filter: 3200 }), success: fx('square', [466, 587, 698, 932], .07, .2, .03), retry: fx('sawtooth', [220, 185], .1, .18, .025), begin: fx('square', [233, 349, 466], .08, .2, .025) } },
  picnic: { id: 'picnic', label: 'Picnic meadow', instruments: 'ukulele pluck, whistle, finger snaps',
    music: { bpm: 104, root: 262, scale: major, chords: [0, 4, 5, 3], melody: [4, 4, 5, 4, 2, null, 0, null], lead: 'triangle', pad: 'sine', bass: 'triangle', drums: 'k.s.k.s.', leadOctave: 1, swing: .1 },
    effects: { action: fx('triangle', [784], 0, .06, .05), place: fx('triangle', [523, 659], .05, .1, .05), success: fx('triangle', [523, 659, 784, 1047, 1319], .07, .3, .045), retry: fx('triangle', [349, 294], .12, .2, .04), begin: fx('triangle', [392, 523, 659], .09, .3, .03) } },
  market: { id: 'market', label: 'Market & shop', instruments: 'steel-drum bell, shaker, coin chimes',
    music: { bpm: 100, root: 247, scale: majorPent, chords: [0, 3, 1, 4], melody: [0, null, 2, 3, 4, null, 3, 2], lead: 'sine', pad: 'triangle', bass: 'square', drums: 'kss.kss.', leadOctave: 2 },
    effects: { action: fx('sine', [1661, 2217], .03, .08, .04), place: fx('sine', [1319, 1760, 2637], .04, .15, .035), success: fx('sine', [988, 1245, 1480, 1976], .08, .35, .04), retry: fx('triangle', [370, 311], .12, .2, .04), begin: fx('sine', [494, 740, 988], .08, .3, .03) } },
  temple: { id: 'temple', label: 'Rune temple', instruments: 'singing bowls, low drone strings, temple block',
    music: { bpm: 66, root: 147, scale: minorPent, chords: [0, 2, 3, 0], melody: [0, null, 3, null, 2, 4, null, null], lead: 'sine', pad: 'sawtooth', bass: 'sine', drums: 'k...t...', leadOctave: 2 },
    effects: { action: fx('sine', [587], 0, .3, .04), place: fx('sine', [440, 660], .06, .4, .04), success: fx('sine', [294, 440, 587, 880], .12, .7, .04), retry: fx('sine', [220, 208], .15, .4, .035), begin: fx('sine', [147, 220, 294], .2, .8, .03) } },
  storybook: { id: 'storybook', label: 'Story Worlds', instruments: 'music-box celesta, warm pad, page-turn brush',
    music: { bpm: 80, root: 262, scale: major, chords: [0, 5, 3, 4], melody: [4, 2, 0, 2, 4, 4, 4, null], lead: 'sine', pad: 'triangle', bass: 'sine', drums: '....s...', leadOctave: 2 },
    effects: { action: fx('sine', [1568], 0, .1, .04), place: fx('sine', [1047, 1319], .05, .2, .04), success: fx('sine', [784, 988, 1175, 1568, 1976], .08, .5, .04), retry: fx('sine', [523, 440], .14, .25, .035), begin: fx('noise', [2400], 0, .25, .03, { filter: 2400 }) } },
  // Profiles for scene-game adapters developed on separate branches/drafts.
  loom: { id: 'loom', label: 'Loom / pattern expedition', instruments: 'harp arpeggio, shuttle clacks, cello bass',
    music: { bpm: 92, root: 208, scale: dorian, chords: [0, 3, 6, 4], melody: [0, 2, 4, 6, 4, 2, null, null], lead: 'triangle', pad: 'sine', bass: 'sawtooth', drums: 'k.t.t.k.', leadOctave: 2 },
    effects: { action: fx('noise', [2000], 0, .05, .04, { filter: 2000 }), place: fx('triangle', [622, 831], .05, .14, .05), success: fx('triangle', [415, 523, 622, 831], .08, .35, .045), retry: fx('triangle', [311, 277], .12, .2, .04), begin: fx('triangle', [208, 311, 415], .1, .3, .03) } },
  balloon: { id: 'balloon', label: 'Balloon airfield', instruments: 'accordion-like reed, breezy whistle, tuba bass',
    music: { bpm: 108, root: 294, scale: major, chords: [0, 3, 4, 4], melody: [0, 4, 4, null, 5, 4, 2, 0], lead: 'sawtooth', pad: 'triangle', bass: 'square', drums: 'k.s.k.ss', leadOctave: 1, swing: .08 },
    effects: { action: fx('sine', [700], 0, .15, .04, { glide: 1.5 }), place: fx('noise', [900], 0, .2, .04, { filter: 900 }), success: fx('triangle', [587, 740, 880, 1175], .08, .4, .045), retry: fx('sine', [500], 0, .3, .04, { glide: .5 }), begin: fx('noise', [600], 0, .5, .03, { filter: 600 }) } },
} satisfies Record<string, AudioProfile>;
export type AudioProfileId = keyof typeof AUDIO_PROFILES;

/** Template → profile. Future adapters add their template id here; tests fail if a template is missing. */
export const TEMPLATE_AUDIO: Record<string, AudioProfileId> = {
  sudoku: 'forest',
  pattern: 'tree', size: 'tree', position: 'tree', missing: 'tree', legs: 'tree',
  sequence: 'river', nim: 'river', compare: 'river', evenodd: 'river', double: 'river',
  odd: 'workshop', lineup: 'workshop', sides: 'workshop', clock: 'workshop', colors: 'workshop',
  count: 'picnic', add: 'picnic', take: 'picnic', share: 'picnic', days: 'picnic',
  coins: 'market', balance: 'market', groups: 'market', change: 'market', fraction: 'market',
  magic: 'temple', cipher: 'temple', riddle: 'temple', shapepick: 'temple',
};
export function profileFor(template: string): AudioProfile {
  return AUDIO_PROFILES[TEMPLATE_AUDIO[template] ?? 'storybook'];
}
