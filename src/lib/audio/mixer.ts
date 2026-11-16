/** Shared audio mixer: one AudioContext, separate music/effects buses, persistent settings, ducking. */
import { AUDIO_PROFILES, type AudioProfile, type EffectVoice } from './profiles';

export interface AudioSettings { muted: boolean; voice: boolean; effects: boolean; music: boolean; musicVolume: number }
const KEY = 'aylas-audio-v1';
export const DEFAULT_SETTINGS: AudioSettings = { muted: false, voice: true, effects: true, music: true, musicVolume: .35 };
let settings: AudioSettings = { ...DEFAULT_SETTINGS };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    else if (localStorage.getItem('forest-sound') === 'off') settings = { ...settings, effects: false };
  } catch { /* private mode */ }
}
export function getAudioSettings(): AudioSettings { load(); return settings; }
export function setAudioSettings(patch: Partial<AudioSettings>) {
  load();
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  applyGains();
  if (!settings.music || settings.muted) stopMusic(); else if (wanted) startMusic(wanted);
  listeners.forEach((l) => l());
}
export function subscribeAudio(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

let ctx: AudioContext | undefined, master: GainNode | undefined, musicBus: GainNode | undefined, fxBus: GainNode | undefined, meter: AnalyserNode | undefined;
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
    master = ctx.createGain(); musicBus = ctx.createGain(); fxBus = ctx.createGain(); meter = ctx.createAnalyser(); meter.fftSize = 2048;
    musicBus.connect(master); fxBus.connect(master); master.connect(ctx.destination); master.connect(meter);
    applyGains(true);
    // iOS reports 'interrupted' after calls/Siri/backgrounding; every state change is surfaced and retried on the next gesture.
    ctx.onstatechange = syncStatus;
  } catch { ctx = undefined; setStatus('error'); }
  return ctx;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { stopMusic(true); void ctx.suspend().catch(() => {}); }
  else void ctx.resume().then(() => { syncStatus(); if (wanted && musicOn()) startMusic(wanted); }).catch(syncStatus);
});
const musicOn = () => settings.music && !settings.muted;
function applyGains(immediate = false) {
  if (!ctx || !master || !musicBus || !fxBus) return;
  const t = ctx.currentTime;
  const m = settings.muted ? 0 : 1, mu = settings.music ? settings.musicVolume * .9 * (ducked ? .25 : 1) : 0, fx = settings.effects ? (ducked ? .4 : 1) : 0;
  if (immediate) { master.gain.value = m; musicBus.gain.value = mu; fxBus.gain.value = fx; return; }
  master.gain.setTargetAtTime(m, t, .05);
  musicBus.gain.setTargetAtTime(mu, t, .15);
  fxBus.gain.setTargetAtTime(fx, t, .05);
}
/** Lower music and effects while narration speaks; restore after. */
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
  try { const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, c.sampleRate); b.connect(c.destination); b.start(0); } catch { /* */ }
  if (c.state === 'running') { setStatus('running'); return Promise.resolve('running'); }
  return c.resume().then(() => { syncStatus(); return getAudioStatus(); }, () => { setStatus('locked'); return 'locked' as AudioStatus; });
}
// Repeatable global unlock: retry on every activation gesture until the context is confirmed running (and again after interruption).
if (typeof window !== 'undefined') {
  const onGesture = () => { if (!ctx || ctx.state !== 'running') void unlockAudio().then((s) => { if (s === 'running' && wanted && musicOn() && !timer) startMusic(wanted); }); };
  for (const e of ['touchend', 'click', 'keydown'] as const) window.addEventListener(e, onGesture, { capture: true, passive: true });
}
/** Peak absolute sample currently leaving the master bus (real rendered PCM, before the device). */
export function outputPeak(): number {
  if (!meter) return 0;
  const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
  let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); return p;
}
export type SoundTestResult = { ok: boolean; status: AudioStatus | 'muted' | 'effects-off'; peak: number };
/** Tap-triggered sound test: confirms resume, plays a chime, and measures the rendered output energy. */
export async function testSound(): Promise<SoundTestResult> {
  load();
  if (settings.muted) return { ok: false, status: 'muted', peak: 0 };
  if (!settings.effects) return { ok: false, status: 'effects-off', peak: 0 };
  const st = await unlockAudio();
  const c = ctx; if (st !== 'running' || !c || !fxBus) return { ok: false, status: st, peak: 0 };
  voice(c, { wave: 'triangle', notes: [523.25, 659.25, 783.99], step: .12, dur: .35, vol: .25 }, fxBus);
  let peak = 0; const end = performance.now() + 500;
  while (performance.now() < end) { await new Promise((r) => setTimeout(r, 30)); peak = Math.max(peak, outputPeak()); }
  return { ok: peak > .01, status: peak > .01 ? 'running' : 'error', peak };
}

function voice(c: AudioContext, v: EffectVoice, out: AudioNode) {
  const now = c.currentTime;
  v.notes.forEach((f, i) => {
    const at = now + i * v.step, g = c.createGain();
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(v.vol, at + .008); g.gain.exponentialRampToValueAtTime(.0001, at + v.dur);
    g.connect(out);
    let src: AudioScheduledSourceNode;
    if (v.wave === 'noise') {
      const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * v.dur)), c.sampleRate), d = buf.getChannelData(0);
      for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * (1 - n / d.length) ** 2;
      const b = c.createBufferSource(); b.buffer = buf;
      const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = v.filter ?? f; flt.Q.value = .8;
      b.connect(flt); flt.connect(g); src = b;
    } else {
      const o = c.createOscillator(); o.type = v.wave; o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * (v.glide ?? .97), at + v.dur);
      o.connect(g); src = o;
    }
    src.start(at); src.stop(at + v.dur + .02);
    src.onended = () => { src.disconnect(); g.disconnect(); };
  });
}
export type EffectKind = keyof AudioProfile['effects'];
/** Play a profile effect for a real game event. Silent when effects are off or audio is unavailable. */
export function playEffect(profile: AudioProfile | string, kind: EffectKind) {
  load();
  if (settings.muted || !settings.effects) return;
  const p = typeof profile === 'string' ? AUDIO_PROFILES[profile as keyof typeof AUDIO_PROFILES] : profile;
  const c = context(); if (!c || !p || !fxBus) return;
  try { if (c.state !== 'running') void unlockAudio(); voice(c, p.effects[kind], fxBus); } catch { /* restricted browser */ }
}

// ---------- Procedural music: a lookahead scheduler, one track at a time ----------
let wanted: AudioProfile | undefined, playing: AudioProfile | undefined, timer: ReturnType<typeof setInterval> | undefined;
let step = 0, nextAt = 0;
/** Each music track owns a gain group and the set of sources it scheduled, so replacement can silence and stop them. */
interface Track { gain: GainNode; sources: Set<AudioScheduledSourceNode>; nodes: AudioNode[] }
let track: Track | undefined;
const track_ = () => track;
function own(t: Track | undefined, src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  if (!t) return;
  t.sources.add(src); t.nodes.push(...nodes);
  const prev = src.onended;
  src.onended = (e) => { t.sources.delete(src); if (typeof prev === 'function') prev.call(src, e); };
}
function disposeTrack(t: Track) {
  const c = ctx; if (!c) return;
  const now = c.currentTime;
  try { t.gain.gain.cancelScheduledValues(now); t.gain.gain.setValueAtTime(t.gain.gain.value, now); t.gain.gain.linearRampToValueAtTime(0, now + .04); } catch { /* closed */ }
  // Stop everything already playing AND everything scheduled for the future.
  t.sources.forEach((s) => { try { s.stop(now + .05); } catch { try { s.stop(); } catch { /* already stopped */ } } });
  setTimeout(() => { t.sources.forEach((s) => { try { s.disconnect(); } catch { /* */ } }); t.sources.clear(); try { t.gain.disconnect(); } catch { /* */ } }, 120);
}
const hz = (p: AudioProfile, degree: number, octave: number) => {
  const s = p.music.scale, o = Math.floor(degree / s.length), i = ((degree % s.length) + s.length) % s.length;
  return p.music.root * 2 ** (octave + o + s[i] / 12);
};
function note(c: AudioContext, out: AudioNode, wave: OscillatorType, f: number, at: number, dur: number, vol: number, attack = .01) {
  const o = c.createOscillator(), g = c.createGain(), flt = c.createBiquadFilter();
  o.type = wave; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.value = wave === 'sine' ? 6000 : 1800;
  g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
  o.connect(flt); flt.connect(g); g.connect(out); o.start(at); o.stop(at + dur + .05);
  o.onended = () => { o.disconnect(); flt.disconnect(); g.disconnect(); };
  own(track_(), o);
}
function drum(c: AudioContext, out: AudioNode, kind: string, at: number) {
  if (kind === 'k') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(160, at); o.frequency.exponentialRampToValueAtTime(60, at + .12);
    g.gain.setValueAtTime(.12, at); g.gain.exponentialRampToValueAtTime(.0001, at + .15); o.connect(g); g.connect(out); o.start(at); o.stop(at + .16); o.onended = () => { o.disconnect(); g.disconnect(); }; own(track_(), o); return; }
  const len = kind === 's' ? .06 : .025, buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
  for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * (1 - n / d.length);
  const b = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); b.buffer = buf; f.type = 'highpass'; f.frequency.value = kind === 's' ? 5000 : 2500; g.gain.value = kind === 's' ? .03 : .05;
  b.connect(f); f.connect(g); g.connect(out); b.start(at); b.onended = () => { b.disconnect(); f.disconnect(); g.disconnect(); }; own(track_(), b);
}
function schedule() {
  const c = ctx, p = playing, out = track?.gain; if (!c || !p || !out) return;
  const m = p.music, eighth = 30 / m.bpm;
  while (nextAt < c.currentTime + .3) {
    const pos = step % 8, bar = Math.floor(step / 8) % m.chords.length, chord = m.chords[bar];
    const at = nextAt + (pos % 2 ? (m.swing ?? 0) * eighth : 0);
    if (pos === 0) {
      [0, 2, 4].forEach((d) => note(c, out, m.pad, hz(p, chord + d, 0), at, eighth * 8, .035, .4));
      note(c, out, m.bass, hz(p, chord, -1), at, eighth * 3, .09);
    }
    if (pos === 4) note(c, out, m.bass, hz(p, chord + 4, -1), at, eighth * 2, .06);
    const mel = m.melody[(pos + (bar % 2 ? 0 : 0)) % 8];
    if (mel !== null && mel !== undefined) note(c, out, m.lead, hz(p, mel + (bar === 3 ? 1 : 0), m.leadOctave - 1), at, eighth * 1.6, .05);
    const dk = m.drums[pos]; if (dk && dk !== '.') drum(c, out, dk, at);
    nextAt += eighth; step++;
  }
}
/** Start the profile's loop (call after a user gesture). Replaces any current track; never overlaps. */
export function startMusic(profile: AudioProfile) {
  load(); wanted = profile;
  if (!musicOn()) return;
  const c = context(); if (!c) return;
  if (playing?.id === profile.id && timer) return;
  stopMusic(true);
  playing = profile; step = 0; nextAt = c.currentTime + .1;
  const gain = c.createGain(); gain.gain.value = 1; gain.connect(musicBus!);
  track = { gain, sources: new Set(), nodes: [] };
  if (c.state !== 'running' && !document.hidden) void unlockAudio();
  timer = setInterval(schedule, 100); schedule();
}
export function stopMusic(keepWanted = false) {
  if (timer) clearInterval(timer);
  timer = undefined; playing = undefined;
  const t = track; track = undefined; if (t) disposeTrack(t);
  if (!keepWanted && !musicOn()) { /* keep wanted so re-enabling resumes */ }
}
/** Route unmount: forget the scene entirely. */
export function releaseMusic(profile?: AudioProfile) { if (!profile || wanted?.id === profile.id) { wanted = undefined; stopMusic(); } }
export const currentTrack = () => playing?.id;
/** Test/diagnostic: number of live music sources owned by the current track. */
export const liveMusicSources = () => track?.sources.size ?? 0;
