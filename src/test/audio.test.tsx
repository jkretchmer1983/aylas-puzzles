import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TEMPLATES } from '@/gen/templates';
import { AUDIO_PROFILES, TEMPLATE_AUDIO, profileFor } from '@/lib/audio/profiles';
import { speechText } from '@/lib/audio/speech-text';
import { getAudioSettings, setAudioSettings, isDucked } from '@/lib/audio/mixer';
import { ReadAloud } from '@/components/ReadAloud';
import { chunkSpeech, getNarration, narrationPayload, setVoice, stopNarration } from '@/lib/audio/narrator';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); setAudioSettings({ muted: false, voice: true, effects: true }); });

function stubSpeech(getVoices: () => unknown[] = () => []) {
  stopNarration();
  const synth = { speak: vi.fn(), cancel: vi.fn(), resume: vi.fn(), getVoices, addEventListener: vi.fn(), speaking: false, pending: false, paused: false };
  class U { text: string; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void; lang = ''; rate = 1; pitch = 1; voice: unknown = null; constructor(t: string) { this.text = t; } }
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', U);
  return synth;
}

describe('audio registry', () => {
  it('every generator template has a registered audio profile', () => {
    for (const t of TEMPLATES) expect(TEMPLATE_AUDIO[t.id], t.id).toBeDefined();
  });
  it('profiles use distinct finite effects per scene', () => {
    const sig = Object.values(AUDIO_PROFILES).map((p) => JSON.stringify(p.effects));
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

describe('combined story + instructions narration', () => {
  const content = { title: 'Fox Market', story: 'Fox sells 5 🍎 at the market.', task: 'How many 🍎 are left?' };
  const both = (c: { title?: string; story?: string; task?: string } = content, g = 'p1') => <><ReadAloud group={g} content={c} label="story" /><ReadAloud group={g} content={c} label="instructions" /></>;
  const expected = 'Fox Market. Fox sells 5 apples at the market. Here is your puzzle. How many apples are left?';
  const spoken = (synth: ReturnType<typeof stubSpeech>) => synth.speak.mock.calls.map((c) => c[0].text).join(' ');
  it('payload is title, story, then task; never anything else', () => {
    expect(narrationPayload(content)).toBe('Fox Market. Fox sells 5 🍎 at the market. Here is your puzzle. How many 🍎 are left?');
    expect(narrationPayload({ title: 'A', story: 'A day out.', task: 'Count' })).toBe('A day out. Here is your puzzle. Count.');
  });
  it('story and instructions buttons speak the SAME full text', () => {
    const synth = stubSpeech();
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    expect(spoken(synth)).toBe(expected);
    expect(isDucked()).toBe(true);
    // Tapping the other control while speaking stops the shared sequence.
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading instructions' }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(isDucked()).toBe(false);
    synth.speak.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(spoken(synth)).toBe(expected);
  });
  it('reads refreshed story/puzzle text and cancels on new puzzle', () => {
    const synth = stubSpeech();
    const { rerender } = render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    synth.cancel.mockClear();
    const next = { title: 'Owl Night', story: 'Owl counts 3 🌟.', task: 'Which is 3rd?' };
    rerender(both(next, 'p2'));
    expect(synth.cancel).toHaveBeenCalled();
    synth.speak.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(spoken(synth)).toBe('Owl Night. Owl counts 3 stars. Here is your puzzle. Which is third?');
  });
  it('long stories are chunked in order with one pinned voice', () => {
    const v1 = { name: 'Samantha', lang: 'en-US', voiceURI: 'sam', localService: true };
    const v2 = { name: 'Daniel', lang: 'en-GB', voiceURI: 'dan', localService: true };
    let voices = [v1];
    const synth = stubSpeech(() => voices);
    setVoice('sam');
    const story = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} is about a happy fox.`).join(' ');
    render(both({ story, task: 'Count the foxes.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    voices = [v2, v1]; setVoice('dan'); // a voice change mid-sequence must not switch voices
    for (let i = 0; i < 40 && synth.speak.mock.calls.length > i; i++) act(() => { const u = synth.speak.mock.calls[i][0]; u.onstart?.(); u.onend?.(); });
    const calls = synth.speak.mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThan(2);
    expect(calls.every((u) => u.text.length <= 180)).toBe(true);
    expect(calls.every((u) => u.voice === v1)).toBe(true);
    expect(calls.map((u) => u.text).join(' ')).toBe(`${story} Here is your puzzle. Count the foxes.`);
    expect(getNarration().status).toBe('idle');
    expect(chunkSpeech('Hi. There.')).toEqual(['Hi. There.']);
  });
  it('shows an honest error beside the button when voice is off', () => {
    const synth = stubSpeech();
    setAudioSettings({ voice: false });
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(synth.speak).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Voice is off');
  });
  it('shows an error when the engine never starts', () => {
    vi.useFakeTimers();
    try {
      stubSpeech();
      render(both());
      fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
      act(() => { vi.advanceTimersByTime(4100); });
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent('didn’t start');
    } finally { vi.useRealTimers(); }
  });
  it('also reports a blocked later chunk instead of remaining stuck speaking', () => {
    vi.useFakeTimers();
    try {
      const synth = stubSpeech();
      render(both({ story: 'A friendly fox walks into the meadow. '.repeat(10), task: 'Count the foxes.' }));
      fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
      act(() => { synth.speak.mock.calls[0]?.[0].onstart?.(); synth.speak.mock.calls[0]?.[0].onend?.(); });
      expect(synth.speak).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(4100));
      expect(getNarration().status).toBe('error');
      expect(synth.cancel).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('supports asynchronously available device voices on the next explicit tap', () => {
    let voices: unknown[] = [];
    const synth = stubSpeech(() => voices);
    setVoice('late');
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    expect(synth.speak.mock.calls[0]?.[0].voice).toBeNull();
    act(() => stopNarration());
    const late = { name: 'Samantha', lang: 'en-US', voiceURI: 'late', localService: true };
    voices = [late]; synth.speak.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(synth.speak.mock.calls[0]?.[0].voice).toBe(late);
  });
  it('stops on hidden tab', () => {
    const synth = stubSpeech();
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    expect(synth.cancel).toHaveBeenCalled();
    expect(getNarration().status).toBe('idle');
  });
});

describe('settings', () => {
  it('persists only voice/effects and master mute', () => {
    setAudioSettings({ muted: true });
    expect(JSON.parse(localStorage.getItem('aylas-audio-v1') ?? '{}')).toMatchObject({ muted: true, voice: true, effects: true });
    expect(getAudioSettings().muted).toBe(true);
  });
});

describe('narrator cancellation', () => {
  it('mute and voice-off cancel the active sequence even outside the settings menu', () => {
    const synth = stubSpeech();
    render(<ReadAloud group="g" content={{ story: 'Hello' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read story and instructions aloud' }));
    synth.cancel.mockClear();
    act(() => setAudioSettings({ muted: true }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(isDucked()).toBe(false);
    act(() => setAudioSettings({ muted: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Read story and instructions aloud' }));
    synth.cancel.mockClear();
    act(() => setAudioSettings({ voice: false }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
  it('unmount cancels speech', () => {
    const synth = stubSpeech();
    const { unmount } = render(<ReadAloud group="g" content={{ task: 'Task' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read story and instructions aloud' }));
    synth.cancel.mockClear(); unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('effects-only lifecycle', () => {
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
      createAnalyser() { return { fftSize: 2048, connect() {}, getFloatTimeDomainData() {} }; }
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
  it('no music nodes or timers from ANY profile, including legacy saved nonzero preferences, gestures and visibility', async () => {
    localStorage.setItem('aylas-audio-v1', JSON.stringify({ muted: false, voice: true, effects: true, music: true, musicVolume: 1 }));
    const { m, P, sources } = await freshMixer();
    expect(m.getAudioSettings()).toEqual({ muted: false, voice: true, effects: true });
    const timers = vi.spyOn(globalThis, 'setInterval');
    for (const profile of Object.values(P)) { m.startMusic(profile); m.releaseMusic(profile); }
    window.dispatchEvent(new Event('click'));
    document.dispatchEvent(new Event('visibilitychange'));
    m.setAudioSettings({ muted: true }); m.setAudioSettings({ muted: false });
    for (const profile of Object.values(P)) m.startMusic(profile);
    expect(m.currentTrack()).toBeUndefined();
    expect(m.liveMusicSources()).toBe(0);
    // A gesture may create one silent WebKit unlock buffer, but never an oscillator or loop.
    expect(sources.filter((s) => 'frequency' in s)).toHaveLength(0);
    expect(timers).not.toHaveBeenCalled(); timers.mockRestore();
  });
  it('scene cleanup stops every finite effect, including future notes; preferences never replay it', async () => {
    const { m, P, sources } = await freshMixer();
    m.playEffect(P.forest, 'success');
    const old = [...sources]; expect(old.length).toBe(4);
    m.stopEffects();
    old.forEach((s) => expect(Math.min(...s.stops)).toBe(0));
    expect(m.liveEffectSources()).toBe(0);
    m.setAudioSettings({ muted: true }); m.setAudioSettings({ muted: false });
    expect(sources).toHaveLength(old.length);
    m.playEffect(P.train, 'place'); expect(sources.length).toBeGreaterThan(old.length);
    m.setAudioSettings({ effects: false }); expect(m.liveEffectSources()).toBe(0);
  });
});
