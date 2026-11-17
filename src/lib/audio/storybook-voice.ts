/**
 * Storybook voice: server TTS (/api/tts, one fixed voice) streamed as PCM into the SAME unlocked
 * Web Audio context and playback session that the game effects use. "Speaking" is reported only
 * after rendered narration energy is measured on the voice bus — never merely because a request
 * was queued. Completed chunks are cached in memory so replays never re-synthesize.
 */
import { voiceOutput, voicePeak, webAudioSupported, type AudioStatus } from './mixer';

const ENDPOINT = '/api/tts';
const RATE = 24000;
const UNAVAILABLE_KEY = 'aylas-storybook-voice-off';
const cache = new Map<string, Float32Array[]>();

export function storybookAvailable(): boolean {
  if (typeof window === 'undefined' || typeof fetch !== 'function' || !webAudioSupported()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try { if (sessionStorage.getItem(UNAVAILABLE_KEY)) return false; } catch { /* private mode */ }
  return true;
}
/** After a terminal service answer (no credits, denied, misconfigured) use the device voice for the rest of the visit. */
export function markStorybookUnavailable() { try { sessionStorage.setItem(UNAVAILABLE_KEY, '1'); } catch { /* ignore */ } }
export const storybookCached = (chunk: string) => cache.has(chunk);
/** Tests/diagnostics: forget synthesized audio. */
export const clearStorybookCache = () => cache.clear();

export type StorybookFailure = { message: string; beforeAudio: boolean; fallback: boolean };
export type StorybookHooks = { onAudible(): void; onDone(): void; onError(f: StorybookFailure): void; onSlow?(): void };
export type StorybookJob = { cancel(): void };

function statusMessage(status: number): { message: string; terminal: boolean } {
  if (status === 402) return { message: 'The storybook voice is out of AI credits right now.', terminal: true };
  if (status === 403) return { message: 'The storybook voice isn’t allowed for this app right now.', terminal: true };
  if (status === 429) return { message: 'The storybook voice is busy. Wait a moment, then tap again.', terminal: false };
  if (status === 400 || status === 401 || status === 404 || status === 500) return { message: 'The storybook voice isn’t set up correctly.', terminal: true };
  return { message: 'The storybook voice had a problem. Tap to try again.', terminal: false };
}

export function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending); bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2), view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

type FetchResult = { ok: true } | { ok: false; message: string; fallback: boolean; aborted?: boolean };
async function fetchChunk(text: string, emit: (s: Float32Array) => void, signal: AbortSignal): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal });
  } catch {
    return signal.aborted ? { ok: false, message: '', fallback: false, aborted: true } : { ok: false, message: 'The storybook voice couldn’t connect.', fallback: true };
  }
  if (!res.ok || !res.body) {
    const m = statusMessage(res.status); if (m.terminal) markStorybookUnavailable();
    return { ok: false, message: m.message, fallback: true };
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', pending: Uint8Array = new Uint8Array(0), done = false, got = 0, bad = false;
  const handle = (block: string) => {
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    let ev: { type?: string; audio?: string; error?: unknown };
    try { ev = JSON.parse(data); } catch { bad = true; return; }
    if (ev.type === 'error' || ev.error) { bad = true; return; }
    if (ev.type === 'speech.audio.done') { done = true; return; }
    if (ev.type !== 'speech.audio.delta' || !ev.audio) return;
    const bin = atob(ev.audio), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const d = decodePCM(pending, bytes); pending = d.pending;
    if (d.samples.length) { got += d.samples.length; emit(d.samples); }
  };
  try {
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true }).replace(/\r/g, '');
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2); }
    }
    if (buf.trim()) handle(buf);
  } catch {
    if (signal.aborted) return { ok: false, message: '', fallback: false, aborted: true };
    return { ok: false, message: 'The storybook voice was interrupted. Tap to try again.', fallback: got === 0 };
  }
  if (bad || !done || !got) return { ok: false, message: 'The storybook voice stopped early. Tap to try again.', fallback: got === 0 };
  return { ok: true };
}

/** Start reading `chunks` in order. `unlocked` must come from unlockAudio() called inside the tap. */
export function startStorybook(chunks: string[], unlocked: Promise<AudioStatus>, h: StorybookHooks): StorybookJob {
  const controller = new AbortController(), sources = new Set<AudioBufferSourceNode>();
  let cancelled = false, audible = false, scheduled = false, playhead = 0, last: Promise<void> = Promise.resolve();
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  const slow = setTimeout(() => { if (!cancelled && !audible) h.onSlow?.(); }, 8000);
  const stopAll = () => {
    cancelled = true; controller.abort(); clearTimeout(slow); if (checkTimer) clearTimeout(checkTimer);
    sources.forEach((s) => { try { s.onended = null; s.stop(); s.disconnect(); } catch { /* ended */ } }); sources.clear();
  };
  const fail = (message: string, fallback: boolean) => { if (cancelled) return; const before = !audible && !scheduled; /* once any narration is queued, never switch voices */ stopAll(); h.onError({ message, beforeAudio: before, fallback }); };
  let out: { ctx: AudioContext; bus: GainNode } | undefined;
  // Honest start: poll the rendered voice bus from the first scheduled sample for up to 2.5 s.
  const confirm = (startAt: number) => {
    const tick = () => {
      if (cancelled || audible || !out) return;
      if (out.ctx.state !== 'running') return fail('Sound is paused by the browser. Tap the speaker again.', false);
      if (voicePeak() > 0.003) { audible = true; h.onAudible(); return; }
      if (out.ctx.currentTime > startAt + 2.5) return fail('The voice didn’t play. Tap to try again.', true);
      checkTimer = setTimeout(tick, 50);
    };
    checkTimer = setTimeout(tick, Math.max(0, (startAt - out!.ctx.currentTime) * 1000));
  };
  const schedule = (samples: Float32Array) => {
    if (cancelled || !out) return;
    const { ctx, bus } = out;
    const buffer = ctx.createBuffer(1, samples.length, RATE);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(bus);
    playhead = Math.max(playhead, ctx.currentTime + 0.08);
    const at = playhead; src.start(at); playhead += buffer.duration; sources.add(src);
    last = new Promise<void>((resolve) => { src.onended = () => { sources.delete(src); try { src.disconnect(); } catch { /* */ } resolve(); }; });
    if (!scheduled) { scheduled = true; confirm(at); }
  };
  void (async () => {
    const st = await unlocked;
    if (cancelled) return;
    if (st !== 'running') return fail(st === 'unsupported' ? 'This browser can’t play the storybook voice.' : 'Sound is blocked by the browser. Tap the speaker again.', st === 'unsupported');
    out = voiceOutput();
    if (!out) return fail('This browser can’t play the storybook voice.', true);
    for (const chunk of chunks) {
      if (cancelled) return;
      const hit = cache.get(chunk);
      if (hit) { hit.forEach(schedule); continue; }
      const pieces: Float32Array[] = [];
      const r = await fetchChunk(chunk, (s) => { pieces.push(s); schedule(s); }, controller.signal);
      if (cancelled) return;
      if (!r.ok) { if (!r.aborted) fail(r.message, r.fallback); return; }
      cache.set(chunk, pieces); if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    }
    await last;
    if (cancelled) return;
    if (!audible) return fail('The voice didn’t play. Tap to try again.', true);
    stopAll(); h.onDone();
  })().catch(() => fail('The storybook voice had a problem. Tap to try again.', true));
  return { cancel: stopAll };
}
