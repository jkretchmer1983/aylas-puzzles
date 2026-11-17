/** Shared audio mixer: one AudioContext, effects only, persistent settings, ducking. */
import { AUDIO_PROFILES, type AudioProfile, type EffectVoice } from './profiles';

export interface AudioSettings { muted: boolean; voice: boolean; effects: boolean }
const KEY = 'aylas-audio-v1';
export const DEFAULT_SETTINGS: AudioSettings = { muted: false, voice: true, effects: true };
let settings: AudioSettings = { ...DEFAULT_SETTINGS };
let loaded = false;
function sanitize(raw: Partial<AudioSettings>): AudioSettings {
  return { muted: typeof raw.muted === 'boolean' ? raw.muted : false,
    voice: typeof raw.voice === 'boolean' ? raw.voice : true,
    effects: typeof raw.effects === 'boolean' ? raw.effects : true };
}
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) settings = sanitize(JSON.parse(raw));
    else if (localStorage.getItem('forest-sound') === 'off') settings = { ...settings, effects: false };
  } catch { /* private mode */ }
}
export function getAudioSettings(): AudioSettings { load(); return settings; }
export function setAudioSettings(patch: Partial<AudioSettings>) {
  load();
  settings = sanitize({ ...settings, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  applyGains();
  if (settings.muted || !settings.effects) stopEffects();
  listeners.forEach((l) => l());
}
export function subscribeAudio(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

let ctx: AudioContext | undefined, master: GainNode | undefined, fxBus: GainNode | undefined, meter: AnalyserNode | undefined;
let voiceBus: GainNode | undefined, voiceMeter: AnalyserNode | undefined;
let ducked = false;
/** Honest engine status for the UI: 'locked' until a real activation gesture has resumed the context. */
export type AudioStatus = 'unsupported' | 'locked' | 'running' | 'error';
let status: AudioStatus = 'locked';
const setStatus = (s: AudioStatus) => { if (status !== s) { status = s; listeners.forEach((l) => l()); } };
export const getAudioStatus = (): AudioStatus => { if (typeof window !== 'undefined' && !audioCtor()) return 'unsupported'; return status; };
const audioCtor = () => window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
const syncStatus = () => { if (ctx) setStatus(ctx.state === 'running' ? 'running' : 'locked'); };
function context(): AudioContext | undefined {
  if (typeof window === 'undefined') return;
  if (ctx && (ctx.state as string) !== 'closed') return ctx;
  const A = audioCtor();
  if (!A) { setStatus('unsupported'); return; }
  try {
    ctx = new A();
    master = ctx.createGain(); fxBus = ctx.createGain(); meter = ctx.createAnalyser(); meter.fftSize = 2048;
    fxBus.connect(master); master.connect(ctx.destination); master.connect(meter);
    // Storybook narration bus: same unlocked context and playback session as the effects (never ducked).
    voiceBus = ctx.createGain(); voiceMeter = ctx.createAnalyser(); voiceMeter.fftSize = 2048;
    voiceBus.connect(master); voiceBus.connect(voiceMeter);
    applyGains(true);
    // iOS reports 'interrupted' after calls/Siri/backgrounding; every state change is surfaced and retried on the next gesture.
    ctx.onstatechange = syncStatus;
  } catch { ctx = undefined; setStatus('error'); }
  return ctx;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { stopEffects(); void ctx.suspend().catch(() => {}); }
  else syncStatus(); // Resume only on the next explicit gesture; never restart sources.
});
function applyGains(immediate = false) {
  if (!ctx || !master || !fxBus) return;
  const t = ctx.currentTime;
  const m = settings.muted ? 0 : 1, fx = settings.effects ? (ducked ? .4 : 1) : 0, vo = settings.voice ? .78 : 0; // TTS is mastered near full scale; headroom avoids clipping after resampling
  if (immediate) { master.gain.value = m; fxBus.gain.value = fx; if (voiceBus) voiceBus.gain.value = vo; return; }
  master.gain.setTargetAtTime(m, t, .05);
  fxBus.gain.setTargetAtTime(fx, t, .05);
  voiceBus?.gain.setTargetAtTime(vo, t, .02);
}
/** Lower effects while narration speaks; restore after. */
export function setDucked(value: boolean) { ducked = value; applyGains(); }
export const isDucked = () => ducked;

/** WebKit (Safari 17+) Audio Session API: 'playback' lets Web Audio play like media instead of the default ambient category. */
function preferPlaybackSession() {
  try { const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (s && s.type !== 'playback') s.type = 'playback'; } catch { /* unsupported */ }
}
/**
 * Call synchronously inside a user-activation event (click / touchend / keydown — iOS does NOT treat pointerdown/touchstart as activation).
 * Resumes (also from 'interrupted'), plays a one-sample silent buffer (WebKit unlock), and resolves to the confirmed state.
 */
export function unlockAudio(): Promise<AudioStatus> {
  load(); preferPlaybackSession();
  const c = context(); if (!c) return Promise.resolve(getAudioStatus());
  try { const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, c.sampleRate); b.connect(c.destination); b.start(0); b.onended = () => b.disconnect(); } catch { /* */ }
  if (c.state === 'running') { setStatus('running'); return Promise.resolve('running'); }
  return c.resume().then(() => { syncStatus(); return getAudioStatus(); }, () => { setStatus('locked'); return 'locked' as AudioStatus; });
}
// Repeatable global unlock: retry on every activation gesture until the context is confirmed running (and again after interruption).
if (typeof window !== 'undefined') {
  const onGesture = () => { if (!ctx || ctx.state !== 'running') void unlockAudio(); };
  for (const e of ['touchend', 'click', 'keydown'] as const) window.addEventListener(e, onGesture, { capture: true, passive: true });
}
/** Peak absolute sample currently leaving the master bus (real rendered PCM, before the device). */
export function outputPeak(): number {
  if (!meter) return 0;
  const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
  let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); return p;
}
/** Narration output on the shared context (created lazily; call after unlockAudio()). */
export function voiceOutput(): { ctx: AudioContext; bus: GainNode } | undefined {
  const c = context(); return c && voiceBus ? { ctx: c, bus: voiceBus } : undefined;
}
/** Peak absolute narration sample actually rendered on the voice bus (proves PCM output, not device audibility). */
export function voicePeak(): number {
  if (!voiceMeter) return 0;
  const d = new Float32Array(voiceMeter.fftSize); voiceMeter.getFloatTimeDomainData(d);
  let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); return p;
}
export const webAudioSupported = () => typeof window !== 'undefined' && !!audioCtor();
export type SoundTestResult = { ok: boolean; status: AudioStatus | 'muted' | 'effects-off'; peak: number };
/** Tap-triggered sound test: confirms resume, plays a chime, and measures the rendered output energy. */
export async function testSound(): Promise<SoundTestResult> {
  load();
  if (settings.muted) return { ok: false, status: 'muted', peak: 0 };
  if (!settings.effects) return { ok: false, status: 'effects-off', peak: 0 };
  const epoch = effectEpoch;
  const st = await unlockAudio();
  if (settings.muted) return { ok: false, status: 'muted', peak: 0 };
  if (!settings.effects || epoch !== effectEpoch) return { ok: false, status: 'effects-off', peak: 0 };
  const c = ctx; if (st !== 'running' || !c || !fxBus) return { ok: false, status: st, peak: 0 };
  voice(c, { wave: 'triangle', notes: [523.25, 659.25, 783.99], step: .12, dur: .35, vol: .25 }, fxBus);
  let peak = 0; const end = performance.now() + 500;
  while (performance.now() < end) { await new Promise((r) => setTimeout(r, 30)); peak = Math.max(peak, outputPeak()); }
  return { ok: peak > .01, status: peak > .01 ? 'running' : 'error', peak };
}

const sources = new Set<AudioScheduledSourceNode>();
let effectEpoch = 0;
export function stopEffects() {
  effectEpoch++;
  sources.forEach((src) => { try { src.stop(); src.disconnect(); } catch { /* ended */ } });
  sources.clear();
}
export const liveEffectSources = () => sources.size;
if (typeof window !== 'undefined') window.addEventListener('pagehide', stopEffects);
function voice(c: AudioContext, v: EffectVoice, out: AudioNode) {
  const now = c.currentTime;
  v.notes.forEach((f, i) => {
    const at = now + i * v.step, g = c.createGain();
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(v.vol, at + .008); g.gain.exponentialRampToValueAtTime(.0001, at + v.dur);
    g.connect(out);
    let src: AudioScheduledSourceNode;
    let filter: BiquadFilterNode | undefined;
    if (v.wave === 'noise') {
      const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * v.dur)), c.sampleRate), d = buf.getChannelData(0);
      for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * (1 - n / d.length) ** 2;
      const b = c.createBufferSource(); b.buffer = buf;
      const flt = c.createBiquadFilter(); filter = flt; flt.type = 'bandpass'; flt.frequency.value = v.filter ?? f; flt.Q.value = .8;
      b.connect(flt); flt.connect(g); src = b;
    } else {
      const o = c.createOscillator(); o.type = v.wave; o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * (v.glide ?? .97), at + v.dur);
      o.connect(g); src = o;
    }
    sources.add(src); src.start(at); src.stop(at + v.dur + .02);
    src.onended = () => { sources.delete(src); src.disconnect(); filter?.disconnect(); g.disconnect(); };
  });
}
export type EffectKind = keyof AudioProfile['effects'];
/** Play a profile effect for a real game event. Silent when effects are off or audio is unavailable. */
export function playEffect(profile: AudioProfile | string, kind: EffectKind) {
  load();
  if (settings.muted || !settings.effects) return;
  const p = typeof profile === 'string' ? AUDIO_PROFILES[profile as keyof typeof AUDIO_PROFILES] : profile;
  const c = context(); if (!c || !p || !fxBus) return;
  const epoch = effectEpoch;
  const play = () => {
    if (epoch !== effectEpoch || document.hidden || settings.muted || !settings.effects || c.state !== 'running' || !fxBus) return;
    try { voice(c, p.effects[kind], fxBus); } catch { setStatus('error'); }
  };
  if (c.state === 'running') play(); else void unlockAudio().then(play);
}

/** Compatibility for older adapters: background music is permanently disabled. */
export function startMusic(_profile?: AudioProfile) { /* intentionally no nodes or timers */ }
export function stopMusic(_keepWanted = false) { /* no music engine exists */ }
export function releaseMusic(_profile?: AudioProfile) { /* no music engine exists */ }
export const currentTrack = () => undefined;
export const liveMusicSources = () => 0;
