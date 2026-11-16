import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TEMPLATES } from '@/gen/templates';
import { AUDIO_PROFILES, TEMPLATE_AUDIO, profileFor } from '@/lib/audio/profiles';
import { speechText } from '@/lib/audio/speech-text';
import { getAudioSettings, setAudioSettings, isDucked } from '@/lib/audio/mixer';
import { ReadAloud } from '@/components/ReadAloud';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); setAudioSettings({ muted: false, voice: true, effects: true, music: true }); });

function stubSpeech() {
  const synth = { speak: vi.fn(), cancel: vi.fn(), resume: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), speaking: false };
  class U { text: string; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void; lang = ''; rate = 1; pitch = 1; voice = null; constructor(t: string) { this.text = t; } }
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', U);
  return synth;
}

describe('audio registry', () => {
  it('every generator template has a registered audio profile', () => {
    for (const t of TEMPLATES) expect(TEMPLATE_AUDIO[t.id], t.id).toBeDefined();
  });
  it('profiles use distinct music (tempo/instruments) per concept', () => {
    const sig = Object.values(AUDIO_PROFILES).map((p) => `${p.music.bpm}-${p.music.lead}-${p.music.drums}-${p.music.root}`);
    expect(new Set(sig).size).toBe(sig.length);
    expect(profileFor('coins').id).toBe('market');
    expect(profileFor('sudoku').id).toBe('forest');
  });
});

describe('spoken text', () => {
  it('verbalizes currency, ordinals, symbols and emoji without changing numbers', () => {
    expect(speechText('You buy a 🍬 for 35¢ with a 100¢ coin.')).toBe('You buy a candy for 35 cents with a 100 cents coin.');
    expect(speechText('How many 🍒 are there?')).toBe('How many cherries are there?');
    expect(speechText('Koala has 1 🍐 and finds 2 more.')).toBe('Koala has 1 pear and finds 2 more.');
    expect(speechText('Who is 3rd in line?')).toBe('Who is third in line?');
    expect(speechText('Each row, column and 2×2 box needs one of each.')).toBe('Each row, column and 2 by 2 box needs one of each.');
    expect(speechText('4 + ? = 9')).toBe('4 plus blank equals 9');
    expect(speechText('1, 2, 4, 8, … What number comes next?')).toBe('1, 2, 4, 8, and so on. What number comes next?');
    expect(speechText('It costs $1.25')).toBe('It costs 1 dollar and 25 cents');
  });
});

describe('shared narrator', () => {
  it('speaks current text, ducks music, and switching speakers stops the previous one', () => {
    const synth = stubSpeech();
    const { rerender } = render(<><ReadAloud text="Story one" label="story" /><ReadAloud text="Task 🍎" /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    expect(synth.speak.mock.calls[0][0].text).toBe('Story one');
    expect(isDucked()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak.mock.calls[1][0].text).toBe('Task apple');
    expect(screen.getByRole('button', { name: 'Read story aloud' })).toHaveAttribute('aria-pressed', 'false');
    act(() => synth.speak.mock.calls[1][0].onend());
    expect(isDucked()).toBe(false);
    rerender(<><ReadAloud text="Story two" label="story" /><ReadAloud text="Task 🍎" /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    expect(synth.speak.mock.calls[2][0].text).toBe('Story two');
  });
  it('reports an honest error when voice is off instead of a fake playing state', () => {
    const synth = stubSpeech();
    setAudioSettings({ voice: false });
    render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(synth.speak).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Voice is turned off');
  });
  it('stops on hidden tab', () => {
    const synth = stubSpeech();
    render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('settings', () => {
  it('persists separate voice/effects/music and master mute', () => {
    setAudioSettings({ music: false, musicVolume: .2, muted: true });
    expect(JSON.parse(localStorage.getItem('aylas-audio-v1')!)).toMatchObject({ music: false, musicVolume: .2, muted: true, voice: true, effects: true });
    expect(getAudioSettings().muted).toBe(true);
  });
});

describe('narrator cancellation', () => {
  it('mute and voice-off cancel the active utterance even outside the settings menu', () => {
    const synth = stubSpeech();
    render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    synth.cancel.mockClear();
    act(() => setAudioSettings({ muted: true }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(isDucked()).toBe(false);
    act(() => setAudioSettings({ muted: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    synth.cancel.mockClear();
    act(() => setAudioSettings({ voice: false }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
  it('text change cancels only its own speaker', () => {
    const synth = stubSpeech();
    const { rerender } = render(<><ReadAloud text="Story" label="story" /><ReadAloud text="Task A" /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    synth.cancel.mockClear();
    rerender(<><ReadAloud text="Story" label="story" /><ReadAloud text="Task B" /></>);
    expect(synth.cancel).not.toHaveBeenCalled();
    rerender(<><ReadAloud text="Story 2" label="story" /><ReadAloud text="Task B" /></>);
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('music track lifecycle', () => {
  type Src = { started: number; stopAt?: number; stops: number[]; onended: null | ((e?: unknown) => void); connect: () => void; disconnect: () => void; start: (t: number) => void; stop: (t?: number) => void };
  function fakeContext() {
    const sources: Src[] = []; const gains: { gain: Record<string, unknown>; disconnected: boolean }[] = [];
    const param = () => ({ value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
    const src = (): Src => { const s: Src = { started: -1, stops: [], onended: null, connect() {}, disconnect() {}, start(t) { s.started = t; }, stop(t = 0) { s.stops.push(t); } }; sources.push(s); return s; };
    class Ctx {
      currentTime = 0; state = 'running'; sampleRate = 8000; destination = {};
      createGain() { const g = { gain: param(), connect() {}, disconnected: false, disconnect() { g.disconnected = true; } }; gains.push(g); return g; }
      createOscillator() { return Object.assign(src(), { type: 'sine', frequency: param() }); }
      createBufferSource() { return Object.assign(src(), { buffer: null }); }
      createBiquadFilter() { return { type: '', frequency: param(), Q: param(), connect() {}, disconnect() {} }; }
      createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
      resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
    }
    return { Ctx, sources, gains };
  }
  async function freshMixer() {
    vi.resetModules();
    const f = fakeContext(); vi.stubGlobal('AudioContext', f.Ctx);
    const m = await import('@/lib/audio/mixer'); const p = await import('@/lib/audio/profiles');
    return { ...f, m, P: p.AUDIO_PROFILES };
  }
  it('replacing a scene stops every source of the old track, including future-scheduled notes', async () => {
    const { m, P, sources } = await freshMixer();
    m.startMusic(P.forest);
    const old = [...sources];
    expect(old.length).toBeGreaterThan(0);
    expect(m.liveMusicSources()).toBe(old.length);
    m.startMusic(P.market);
    expect(m.currentTrack()).toBe('market');
    // Old pad/bass notes were scheduled to end far later; each must be re-stopped within ~50ms.
    old.forEach((s) => expect(Math.min(...s.stops)).toBeLessThanOrEqual(0.06));
    expect(m.liveMusicSources()).toBe(sources.length - old.length);
  });
  it('release, mute and music-off silence the live track sources', async () => {
    const { m, P, sources } = await freshMixer();
    m.startMusic(P.river); let live = [...sources];
    m.releaseMusic(P.river);
    live.forEach((s) => expect(Math.min(...s.stops)).toBeLessThanOrEqual(0.06));
    expect(m.currentTrack()).toBeUndefined();
    m.startMusic(P.temple); live = sources.slice(live.length);
    m.setAudioSettings({ muted: true });
    live.forEach((s) => expect(Math.min(...s.stops)).toBeLessThanOrEqual(0.06));
    m.setAudioSettings({ muted: false });
    expect(m.currentTrack()).toBe('temple');
    const again = sources.slice(sources.length - m.liveMusicSources());
    m.setAudioSettings({ music: false });
    again.forEach((s) => expect(Math.min(...s.stops)).toBeLessThanOrEqual(0.06));
    m.setAudioSettings({ music: true });
  });
});
