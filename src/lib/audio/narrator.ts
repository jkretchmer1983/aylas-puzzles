/**
 * Shared narrator: one owner, one sequence of utterances at a time, gesture-started,
 * voice-list tolerant, ducks the mixer. Every story/instructions speaker reads the
 * SAME combined payload (story, then instructions) built by narrationPayload().
 */
import { getAudioSettings, setDucked, subscribeAudio, unlockAudio } from './mixer';
import { speechText } from './speech-text';

export type NarrationState = { id: string | null; status: 'idle' | 'loading' | 'speaking' | 'error'; error?: string };
let state: NarrationState = { id: null, status: 'idle' };
const listeners = new Set<() => void>();
const set = (s: NarrationState) => { state = s; listeners.forEach((l) => l()); };
export const getNarration = () => state;
export function subscribeNarration(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const narrationSupported = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';

/** Combined read-aloud text: optional title, story, then the authoritative task. Never answers. */
export function narrationPayload({ title, story, task }: { title?: string; story?: string; task?: string }): string {
  const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
  const end = (s: string) => (s && !/[.!?…:]$/.test(s) ? `${s}.` : s);
  const t = clean(title), st = clean(story), k = clean(task);
  return [t && !st.startsWith(t) ? end(t) : '', end(st), k ? `Here is your puzzle. ${end(k)}` : ''].filter(Boolean).join(' ');
}

/** Split spoken text into sentence chunks (≤ max chars) so long stories don't get cut off. */
export function chunkSpeech(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["’”)]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = []; let buf = '';
  const push = (s: string) => { const v = s.trim(); if (v) out.push(v); };
  for (const raw of sentences) {
    let s = raw;
    while (s.length > max) { const cut = s.lastIndexOf(',', max) > 40 ? s.lastIndexOf(',', max) + 1 : s.lastIndexOf(' ', max) > 40 ? s.lastIndexOf(' ', max) : max; push(buf); buf = ''; push(s.slice(0, cut)); s = s.slice(cut); }
    if ((buf + s).length > max) { push(buf); buf = s; } else buf += s;
  }
  push(buf);
  return out;
}

const VOICE_KEY = 'aylas-voice-v1';
let voice: SpeechSynthesisVoice | null | undefined;
const voiceListeners = new Set<() => void>();
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!narrationSupported()) return [];
  const all = window.speechSynthesis.getVoices?.() ?? [];
  const en = all.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return en.length ? en : all;
}
function pickVoice(): SpeechSynthesisVoice | null {
  const en = englishVoices();
  if (!en.length) return null;
  let saved: string | null = null; try { saved = localStorage.getItem(VOICE_KEY); } catch { /* private mode */ }
  const chosen = saved ? en.find((v) => v.voiceURI === saved) : undefined;
  if (chosen) return chosen;
  const prefer = [/samantha/i, /ava/i, /allison/i, /karen/i, /google us english/i, /natural/i, /aria|jenny/i, /female/i];
  for (const r of prefer) { const v = en.find((x) => r.test(x.name)); if (v) return v; }
  return en.find((v) => v.localService) ?? en[0];
}
export const selectedVoice = () => { if (voice === undefined || voice === null) voice = narrationSupported() ? pickVoice() : null; return voice; };
export function setVoice(uri: string) {
  try { localStorage.setItem(VOICE_KEY, uri); } catch { /* ignore */ }
  voice = pickVoice(); voiceListeners.forEach((l) => l());
}
export function subscribeVoices(l: () => void) { voiceListeners.add(l); return () => { voiceListeners.delete(l); }; }

if (typeof window !== 'undefined') {
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
    // Keep the voice pinned while a sequence is running; refresh afterwards.
    if (!seq) voice = pickVoice();
    voiceListeners.forEach((l) => l());
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopNarration(); });
  window.addEventListener('pagehide', () => stopNarration());
}
subscribeAudio(() => { const a = getAudioSettings(); if ((a.muted || !a.voice) && seq) stopNarration(); });

type Seq = { id: string; chunks: string[]; i: number; voice: SpeechSynthesisVoice | null; started: boolean };
let seq: Seq | null = null, current: SpeechSynthesisUtterance | null = null, watchdog: ReturnType<typeof setTimeout> | undefined;
/** Test/diagnostic: the voice pinned to the running sequence. */
export const activeSequence = () => seq && { id: seq.id, chunks: [...seq.chunks], voice: seq.voice };

const finish = (s: NarrationState) => {
  seq = null; current = null; if (watchdog) clearTimeout(watchdog); watchdog = undefined; setDucked(false); set(s);
};
function speakChunk(q: Seq) {
  const synth = window.speechSynthesis, u = new SpeechSynthesisUtterance(q.chunks[q.i]);
  if (q.voice) u.voice = q.voice;
  u.lang = q.voice?.lang ?? 'en-US'; u.rate = .9; u.pitch = 1.05;
  u.onstart = () => { if (current !== u) return; q.started = true; if (watchdog) clearTimeout(watchdog); watchdog = undefined; if (state.status !== 'speaking') set({ id: q.id, status: 'speaking' }); };
  u.onend = () => {
    if (current !== u || seq !== q) return;
    q.i++;
    if (q.i >= q.chunks.length) finish({ id: null, status: 'idle' }); else speakChunk(q);
  };
  u.onerror = (e) => {
    if (current !== u || seq !== q) return;
    finish(e.error === 'interrupted' || e.error === 'canceled' ? { id: null, status: 'idle' } : { id: q.id, status: 'error', error: 'Couldn’t read that aloud. Tap to try again.' });
  };
  current = u;
  {
    // Honest watchdog: if the engine never starts, show an error, never a fake "playing" state.
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => { if (seq === q && current === u && state.status !== 'speaking') { synth.cancel(); finish({ id: q.id, status: 'error', error: 'Read aloud didn’t start. Check the volume, then tap again.' }); } }, 4000);
  }
  // Each chunk needs its own start acknowledgement (a later chunk may also be blocked).
  set({ id: q.id, status: 'loading' });
  try { synth.speak(u); } catch {
    synth.cancel(); finish({ id: q.id, status: 'error', error: 'Couldn’t read that aloud. Tap to try again.' });
  }
}
/** Must be called directly inside a tap handler (iOS requires the gesture). */
export function speak(id: string, text: string) {
  void unlockAudio();
  if (!narrationSupported()) { set({ id, status: 'error', error: 'Read aloud isn’t available on this device.' }); return; }
  const a = getAudioSettings();
  if (a.muted) { set({ id, status: 'error', error: 'Sound is muted. Turn off “Mute all sound” in sound settings.' }); return; }
  if (!a.voice) { set({ id, status: 'error', error: 'Voice is off in sound settings.' }); return; }
  const synth = window.speechSynthesis;
  // Only cancel when something is queued: Safari can drop a speak() issued right after cancel().
  if (seq || synth.speaking || synth.pending) stopNarration();
  const chunks = chunkSpeech(speechText(text));
  if (!chunks.length) { set({ id, status: 'error', error: 'There’s nothing to read yet.' }); return; }
  const q: Seq = { id, chunks, i: 0, voice: selectedVoice(), started: false };
  seq = q; setDucked(true); set({ id, status: 'loading' });
  if (synth.paused) synth.resume();
  speakChunk(q);
}
export function stopNarration() {
  if (!narrationSupported()) return;
  const was = seq; seq = null; current = null; if (watchdog) clearTimeout(watchdog); watchdog = undefined;
  window.speechSynthesis.cancel();
  if (was || state.status !== 'idle') { setDucked(false); set({ id: null, status: 'idle' }); }
}
export function stopNarrationFor(id: string) { if (state.id === id) stopNarration(); }
