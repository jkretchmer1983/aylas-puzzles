/**
 * Storybook-voice engine tests. Web Audio OUTPUT is simulated here (fake context + measured peak);
 * these prove sequencing/state honesty, not audibility. Real PCM is measured in the browser check.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReadAloud } from '@/components/ReadAloud';

type Src = { at?: number; stopped?: boolean; onended: null | (() => void); connect(): void; disconnect(): void; start(t: number): void; stop(): void; buffer: unknown };
const A = vi.hoisted(() => ({ peak: 0, state: 'running' as string, now: 0, sources: [] as Src[], unlock: 'running' as string }));
const ctx = {
  get currentTime() { return A.now; }, get state() { return A.state; },
  createBuffer: (_c: number, n: number, r: number) => ({ duration: n / r, getChannelData: () => new Float32Array(n) }),
  createBufferSource: () => { const s: Src = { onended: null, buffer: null, connect() {}, disconnect() {}, start(t) { s.at = t; }, stop() { s.stopped = true; } }; A.sources.push(s); return s; },
};
vi.mock('@/lib/audio/mixer', async (orig) => ({
  ...await orig<object>(),
  unlockAudio: () => Promise.resolve(A.unlock), webAudioSupported: () => true, voicePeak: () => A.peak,
  voiceOutput: () => ({ ctx, bus: {} }),
}));
const N = await import('@/lib/audio/narrator');
const SB = await import('@/lib/audio/storybook-voice');

function sse(ok = true) {
  const pcm = new Int16Array(2400).fill(8000); // 0.1 s of non-silent PCM
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
  return `data: ${JSON.stringify({ type: 'speech.audio.delta', audio: b64 })}\n\n${ok ? `data: ${JSON.stringify({ type: 'speech.audio.done' })}\n\n` : ''}`;
}
let bodies: string[] = [];
let respond: (i: number) => Response | Promise<Response> = () => new Response(sse(), { status: 200 });
let synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; getVoices: () => unknown[]; addEventListener: () => void; speaking: boolean; pending: boolean; paused: boolean };
const sam = { name: 'Samantha', lang: 'en-US', voiceURI: 'sam', localService: true };
beforeEach(() => {
  SB.clearStorybookCache();
  A.peak = 0; A.state = 'running'; A.now = 0; A.sources = []; A.unlock = 'running'; bodies = [];
  respond = () => new Response(sse(), { status: 200 });
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body)).text); return respond(bodies.length - 1); }));
  synth = { speak: vi.fn(), cancel: vi.fn(), resume: vi.fn(), getVoices: () => [sam], addEventListener: () => {}, speaking: false, pending: false, paused: false };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; voice: unknown = null; volume = 1; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void; constructor(t: string) { this.text = t; } });
});
afterEach(() => { N.stopNarration(); cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const content = { title: 'Fox Market', story: 'Fox sells 5 🍎 at the market.', task: 'How many 🍎 are left?' };
const spoken = 'Fox Market. Fox sells 5 apples at the market. Here is your puzzle. How many apples are left?';
const both = (c = content) => <><ReadAloud group="p" content={c} label="story" /><ReadAloud group="p" content={c} label="instructions" /></>;
const realSpeech = () => synth.speak.mock.calls.map((c) => c[0]).filter((u) => u.text);
const endAll = () => act(() => { A.now += 10; A.sources.forEach((s) => s.onended?.()); });

describe('storybook voice (default engine)', () => {
  it('both speakers send the same story-then-instructions text; Stop shows only after rendered voice energy', async () => {
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(A.sources.length).toBe(1));
    expect(bodies).toEqual([spoken]);
    expect(N.getNarration()).toMatchObject({ status: 'loading', engine: 'storybook' }); // queued audio is NOT "speaking"
    expect(screen.getByRole('button', { name: 'Stop reading story' })).toHaveAttribute('aria-busy', 'true'); // spinner, cancellable
    A.peak = 0.2; A.now = 0.2;
    await waitFor(() => expect(N.getNarration().status).toBe('speaking'));
    expect(screen.getByRole('button', { name: 'Stop reading instructions' })).toHaveAttribute('aria-busy', 'false');
    endAll();
    await waitFor(() => expect(N.getNarration().status).toBe('idle'));
    // Second speaker replays the SAME payload from cache — no new synthesis, same voice.
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    await waitFor(() => expect(A.sources.length).toBe(2));
    expect(bodies).toEqual([spoken]);
    expect(realSpeech()).toHaveLength(0);
  });
  it('long text is synthesized in order, one engine for every chunk', async () => {
    const story = Array.from({ length: 14 }, (_, i) => `Sentence ${i + 1} tells how the happy fox found a shiny pebble.`).join(' ');
    render(both({ title: '', story, task: 'Count the pebbles.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    A.peak = 0.2;
    await waitFor(() => expect(bodies.length).toBeGreaterThan(2));
    await waitFor(() => expect(A.sources.length).toBe(bodies.length));
    expect(bodies.every((b) => b.length <= 320)).toBe(true);
    expect(bodies.join(' ')).toBe(`${story} Here is your puzzle. Count the pebbles.`);
    expect(N.activeSequence()?.engine).toBe('storybook');
    // Each chunk is scheduled after the previous one on one timeline.
    const at = A.sources.map((s) => s.at ?? 0); expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('no rendered energy → visible error path, never a perpetual silent Stop', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(A.sources.length).toBe(1));
    A.now = 3; // 2.5 s past the first scheduled sample with zero energy
    await waitFor(() => expect(N.getNarration().status).toBe('error'));
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('didn’t play');
    expect(A.sources[0].stopped).toBe(true);
  });
  it('blocked audio context reports an actionable error', async () => {
    A.unlock = 'locked';
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(N.getNarration().status).toBe('error'));
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Tap the speaker again');
    expect(bodies).toHaveLength(0);
  });
  it('service failure before any audio falls back to ONE device voice with a visible note; terminal failures stick for the visit', async () => {
    respond = () => new Response('{"error":"no credits"}', { status: 402 });
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(realSpeech()).toHaveLength(1));
    const u = realSpeech()[0];
    expect(u.voice).toBe(sam); expect(u.text).toBe(spoken);
    act(() => u.onstart?.());
    expect(N.getNarration()).toMatchObject({ status: 'speaking', engine: 'device' });
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('out of AI credits');
    act(() => u.onend?.());
    synth.speak.mockClear(); bodies = [];
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(bodies).toHaveLength(0); // goes straight to the device voice
    expect(realSpeech()[0]?.voice).toBe(sam);
  });
  it('failure AFTER audio started shows an error instead of switching voices mid-story', async () => {
    respond = (i) => i === 0 ? new Response(sse(), { status: 200 }) : new Response('x', { status: 503 });
    const story = Array.from({ length: 10 }, (_, i) => `Sentence ${i + 1} tells how the happy fox found a shiny pebble.`).join(' ');
    A.peak = 0.2;
    render(both({ title: '', story, task: 'Count.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(N.getNarration().status).toBe('error'));
    expect(A.sources.length).toBeGreaterThan(0);
    expect(A.sources.every((s) => s.stopped)).toBe(true);
    expect(realSpeech()).toHaveLength(0);
  });
  it('stop during a pending request aborts it and schedules nothing afterwards', async () => {
    let release!: (r: Response) => void;
    respond = () => new Promise<Response>((r) => { release = r; });
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading instructions' }));
    expect(N.getNarration().status).toBe('idle');
    release(new Response(sse(), { status: 200 }));
    await new Promise((r) => setTimeout(r, 30));
    expect(A.sources).toHaveLength(0);
    expect(N.getNarration().status).toBe('idle');
  });
  it('a speaker unmounting (story panel closing) or rerendering keeps reading; new text or no speakers stops it', async () => {
    A.peak = 0.2;
    const view = render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    await waitFor(() => expect(N.getNarration().status).toBe('speaking'));
    view.rerender(<ReadAloud group="p" content={{ ...content }} label="instructions" />);
    expect(N.getNarration().status).toBe('speaking');
    view.rerender(<ReadAloud group="p" content={{ ...content, task: 'Which is 3rd?' }} label="instructions" />);
    expect(N.getNarration().status).toBe('idle');
    expect(A.sources.every((s) => s.stopped)).toBe(true);
  });
});

describe('device voice engine', () => {
  it('expired saved voice never pins silence: storybook when online, auto device voice offline', () => {
    localStorage.setItem('aylas-voice-v1', 'gone-uri');
    expect(N.resolveNarrationVoice()).toEqual({ engine: 'storybook' });
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    expect(N.resolveNarrationVoice()).toEqual({ engine: 'device', voiceURI: 'sam' });
  });
  it('chosen device voice: resumes a paused engine, keeps utterances, same voice from both speakers; voices loading late is picked up on next tap', () => {
    let voices: unknown[] = [];
    synth.getVoices = () => voices; synth.paused = true;
    N.setVoice('sam');
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    render(both());
    fireEvent.click(screen.getByRole('button', { name: 'Read story aloud' }));
    expect(synth.resume).toHaveBeenCalled();
    expect(realSpeech()[0].voice).toBeNull();
    expect(N.getNarration().status).toBe('loading'); // not "speaking" until onstart
    act(() => N.stopNarration());
    voices = [sam]; synth.speak.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Read instructions aloud' }));
    expect(realSpeech()[0].voice).toBe(sam);
    expect(realSpeech()[0].volume).toBe(1);
  });
});
