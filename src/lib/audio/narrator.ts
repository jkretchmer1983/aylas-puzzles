/**
 * Shared narrator: one owner, one sequence at a time. Every story/instructions speaker reads the
 * SAME combined payload (story, then instructions) built by narrationPayload().
 *
 * Engines (pinned for a whole sequence, so every chunk uses one voice):
 *  - 'storybook' (default when online): server TTS played through the shared Web Audio context —
 *    the same output path as the game effects, so it is not subject to iOS speech-engine silence.
 *  - 'device': speechSynthesis with a saved/auto device voice (offline, or chosen in settings).
 */
import { getAudioSettings, setDucked, subscribeAudio, unlockAudio, voicePeak } from './mixer';
import { speechText } from './speech-text';
import { startStorybook, storybookAvailable, type StorybookJob } from './storybook-voice';

export type NarrationEngine = 'storybook' | 'device';
export type NarrationState = { id: string | null; status: 'idle' | 'loading' | 'speaking' | 'error'; error?: string | undefined; note?: string | undefined; engine?: NarrationEngine | undefined };
let state: NarrationState = { id: null, status: 'idle' };
const listeners = new Set<() => void>();
const set = (s: NarrationState) => { state = s; listeners.forEach((l) => l()); };
export const getNarration = () => state;
export function subscribeNarration(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const deviceSpeechSupported = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
/** Some narration engine exists here (storybook voice or device speech). */
export const narrationSupported = () => deviceSpeechSupported() || storybookAvailable();

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

// ---------- voice preference ----------
export const STORYBOOK_VOICE = 'storybook';
const VOICE_KEY = 'aylas-voice-v1';
const voiceListeners = new Set<() => void>();
const savedPref = (): string | null => { try { return localStorage.getItem(VOICE_KEY); } catch { return null; } };
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!deviceSpeechSupported()) return [];
  const all = window.speechSynthesis.getVoices?.() ?? [];
  const en = all.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return en.length ? en : all;
}
const findVoice = (uri: string) => englishVoices().find((v) => v.voiceURI === uri) ?? null;
function autoVoice(): SpeechSynthesisVoice | null {
  const en = englishVoices(); if (!en.length) return null;
  const prefer = [/samantha/i, /ava/i, /allison/i, /karen/i, /google us english/i, /natural/i, /aria|jenny/i, /female/i];
  for (const r of prefer) { const v = en.find((x) => r.test(x.name)); if (v) return v; }
  return en.find((v) => v.localService) ?? en[0];
}
/** Device voice used by the device engine: the saved voice if still installed, else an automatic pick. Always looked up fresh (iOS voice objects go stale). */
export function selectedVoice(): SpeechSynthesisVoice | null {
  const p = savedPref();
  return (p && p !== STORYBOOK_VOICE ? findVoice(p) : null) ?? autoVoice();
}
/** 'storybook' or a device voiceURI. Default is the storybook voice. */
export const voicePreference = () => savedPref() ?? STORYBOOK_VOICE;
export function setVoice(pref: string) {
  try { localStorage.setItem(VOICE_KEY, pref); } catch { /* ignore */ }
  voiceListeners.forEach((l) => l());
}
export function subscribeVoices(l: () => void) { voiceListeners.add(l); return () => { voiceListeners.delete(l); }; }

type Choice = { engine: 'storybook' } | { engine: 'device'; voiceURI: string | null; note?: string };
/** Resolve the engine/voice once per sequence. A stale saved device voice never pins silence. */
export function resolveNarrationVoice(): Choice | null {
  const pref = voicePreference(), book = storybookAvailable();
  if (pref === STORYBOOK_VOICE) {
    if (book) return { engine: 'storybook' };
    return deviceSpeechSupported() ? { engine: 'device', voiceURI: autoVoice()?.voiceURI ?? null, note: 'Using this device’s voice while offline.' } : null;
  }
  const saved = findVoice(pref);
  if (saved) return { engine: 'device', voiceURI: saved.voiceURI };
  if (book) return { engine: 'storybook' };
  return deviceSpeechSupported() ? { engine: 'device', voiceURI: autoVoice()?.voiceURI ?? null } : null;
}

// ---------- reader registrations (several speakers share one sequence) ----------
const readers: { id: string; text: string }[] = [];
/** Called by each mounted speaker. Narration stops only when NO mounted speaker still shows the text being read. */
export function registerReader(id: string, text: string) {
  const r = { id, text }; readers.push(r);
  return () => {
    const i = readers.indexOf(r); if (i >= 0) readers.splice(i, 1);
    if (seq && seq.id === id && !readers.some((x) => x.id === id && x.text === seq!.text)) stopNarration();
  };
}

// ---------- sequence ----------
type Seq = { id: string; text: string; chunks: string[]; i: number; engine: NarrationEngine; voiceURI: string | null; note?: string | undefined; job?: StorybookJob | undefined };
let seq: Seq | null = null, current: SpeechSynthesisUtterance | null = null, watchdog: ReturnType<typeof setTimeout> | undefined;
/** Utterances are kept referenced until they end so the engine can't drop them (WebKit GC bug). */
const alive = new Set<SpeechSynthesisUtterance>();
/** Test/diagnostic: the engine/voice pinned to the running sequence. */
export const activeSequence = () => seq && { id: seq.id, chunks: [...seq.chunks], engine: seq.engine, voiceURI: seq.voiceURI };

if (typeof window !== 'undefined') {
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => voiceListeners.forEach((l) => l()));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopNarration(); });
  window.addEventListener('pagehide', () => stopNarration());
}
// Dev-only diagnostics for browser checks (real rendered narration PCM, not device audibility).
if (typeof window !== 'undefined' && import.meta.env?.DEV) (window as unknown as Record<string, unknown>).__aylasNarration = { getNarration: () => state, voicePeak, activeSequence: () => activeSequence() };
subscribeAudio(() => { const a = getAudioSettings(); if ((a.muted || !a.voice) && seq) stopNarration(); });

const clearWatch = () => { if (watchdog) clearTimeout(watchdog); watchdog = undefined; };
const finish = (s: NarrationState) => {
  const j = seq?.job; seq = null; current = null; clearWatch(); j?.cancel(); setDucked(false); set(s);
};
const fail = (q: Seq, error: string) => finish({ id: q.id, status: 'error', error, engine: q.engine });

function speakDeviceChunk(q: Seq) {
  const synth = window.speechSynthesis;
  const voice = q.voiceURI ? findVoice(q.voiceURI) : null;
  if (q.voiceURI && !voice) { synth.cancel(); fail(q, 'The reading voice changed. Tap to try again.'); return; }
  const u = new SpeechSynthesisUtterance(q.chunks[q.i]);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US'; u.rate = .9; u.pitch = 1.05; u.volume = 1;
  alive.add(u);
  u.onstart = () => { if (current !== u) return; clearWatch(); if (state.status !== 'speaking') set({ id: q.id, status: 'speaking', engine: 'device', note: q.note }); };
  u.onend = () => {
    alive.delete(u);
    if (current !== u || seq !== q) return;
    q.i++;
    if (q.i >= q.chunks.length) finish({ id: null, status: 'idle' }); else speakDeviceChunk(q);
  };
  u.onerror = (e) => {
    alive.delete(u);
    if (current !== u || seq !== q) return;
    if (e.error === 'interrupted' || e.error === 'canceled') finish({ id: null, status: 'idle' });
    else fail(q, e.error === 'not-allowed' ? 'This device blocked read aloud. Tap the speaker again.' : 'Couldn’t read that aloud. Tap to try again.');
  };
  current = u;
  clearWatch();
  // Honest watchdog: every chunk must really start, or the button shows an error (never a silent Stop icon).
  watchdog = setTimeout(() => { if (seq === q && current === u) { synth.cancel(); fail(q, 'Read aloud didn’t start. Check the volume, then tap again.'); } }, 4000);
  if (state.status !== 'speaking') set({ id: q.id, status: 'loading', engine: 'device', note: q.note });
  try { if (synth.paused) synth.resume(); synth.speak(u); } catch { synth.cancel(); fail(q, 'Couldn’t read that aloud. Tap to try again.'); }
}

let primed = false;
/** iOS: speak an empty utterance inside the tap so a later device-voice fallback is allowed outside the gesture. */
function primeDeviceSpeech() {
  if (primed || !deviceSpeechSupported()) return;
  primed = true;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; alive.add(u); u.onend = u.onerror = () => alive.delete(u); window.speechSynthesis.speak(u); } catch { /* best effort */ }
}

function startStorybookSeq(q: Seq, unlocked: ReturnType<typeof unlockAudio>) {
  set({ id: q.id, status: 'loading', engine: 'storybook' });
  q.job = startStorybook(q.chunks, unlocked, {
    onAudible: () => { if (seq === q) set({ id: q.id, status: 'speaking', engine: 'storybook' }); },
    onSlow: () => { if (seq === q && state.status === 'loading') set({ id: q.id, status: 'loading', engine: 'storybook', note: 'Still getting the voice ready…' }); },
    onDone: () => { if (seq === q) finish({ id: null, status: 'idle' }); },
    onError: (f) => {
      if (seq !== q) return;
      q.job = undefined;
      // Never switch voices mid-story: fall back only when nothing has been heard yet.
      if (f.beforeAudio && f.fallback && deviceSpeechSupported()) {
        q.engine = 'device'; q.voiceURI = selectedVoice()?.voiceURI ?? null; q.i = 0; q.chunks = chunkSpeech(speechText(q.text), 180);
        q.note = `${f.message} Using this device’s voice instead — if it’s silent, turn off the iPad’s silent mode.`;
        speakDeviceChunk(q);
      } else fail(q, f.message);
    },
  });
}

/** Must be called directly inside a tap handler (iOS requires the gesture). */
export function speak(id: string, text: string) {
  const unlocked = unlockAudio(); // synchronous inside the gesture
  const a = getAudioSettings();
  if (a.muted) { set({ id, status: 'error', error: 'Sound is muted. Turn off “Mute all sound” in sound settings.' }); return; }
  if (!a.voice) { set({ id, status: 'error', error: 'Voice is off in sound settings.' }); return; }
  const choice = resolveNarrationVoice();
  if (!choice) { set({ id, status: 'error', error: 'Read aloud isn’t available on this device.' }); return; }
  // Only cancel when something is running: Safari can drop a speak() issued right after cancel().
  if (seq) stopNarration();
  else if (deviceSpeechSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
  const spoken = speechText(text);
  const chunks = chunkSpeech(spoken, choice.engine === 'storybook' ? 320 : 180);
  if (!chunks.length) { set({ id, status: 'error', error: 'There’s nothing to read yet.' }); return; }
  const q: Seq = { id, text, chunks, i: 0, engine: choice.engine, voiceURI: choice.engine === 'device' ? choice.voiceURI : null, note: choice.engine === 'device' ? choice.note : undefined };
  seq = q; setDucked(true);
  if (choice.engine === 'device') speakDeviceChunk(q);
  else { primeDeviceSpeech(); startStorybookSeq(q, unlocked); }
}
export function stopNarration() {
  const was = seq; seq = null; current = null; clearWatch(); was?.job?.cancel();
  if (deviceSpeechSupported() && (was?.engine === 'device' || window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
  if (was || state.status !== 'idle') { setDucked(false); set({ id: null, status: 'idle' }); }
}
export function stopNarrationFor(id: string) { if (state.id === id) stopNarration(); }
