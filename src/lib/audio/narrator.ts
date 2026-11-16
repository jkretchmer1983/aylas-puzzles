/** Shared narrator: one utterance at a time, gesture-started, voice-list tolerant, ducks the mixer. */
import { getAudioSettings, setDucked, subscribeAudio, unlockAudio } from './mixer';
import { speechText } from './speech-text';

export type NarrationState = { id: string | null; status: 'idle' | 'loading' | 'speaking' | 'error'; error?: string };
let state: NarrationState = { id: null, status: 'idle' };
const listeners = new Set<() => void>();
const set = (s: NarrationState) => { state = s; listeners.forEach((l) => l()); };
export const getNarration = () => state;
export function subscribeNarration(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const narrationSupported = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices?.() ?? [];
  if (!all.length) return null;
  const en = all.filter((v) => /^en[-_]/i.test(v.lang));
  const prefer = [/samantha/i, /ava/i, /allison/i, /karen/i, /google us english/i, /natural/i, /aria|jenny/i, /female/i];
  for (const r of prefer) { const v = en.find((x) => r.test(x.name)); if (v) return v; }
  return en.find((v) => v.localService) ?? en[0] ?? all[0];
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopNarration(); });
  window.addEventListener('pagehide', () => stopNarration());
}
// Mute or voice-off from anywhere cancels the active utterance.
subscribeAudio(() => { const a = getAudioSettings(); if ((a.muted || !a.voice) && current) stopNarration(); });
let current: SpeechSynthesisUtterance | null = null, watchdog: ReturnType<typeof setTimeout> | undefined;
const finish = (u: SpeechSynthesisUtterance, s: NarrationState) => {
  if (current !== u) return;
  current = null; if (watchdog) clearTimeout(watchdog); setDucked(false); set(s);
};
/** Must be called directly inside a tap handler (iOS requires the gesture). */
export function speak(id: string, text: string) {
  unlockAudio();
  if (!narrationSupported()) { set({ id, status: 'error', error: 'Read aloud isn’t available on this device.' }); return; }
  if (!getAudioSettings().voice || getAudioSettings().muted) { set({ id, status: 'error', error: 'Voice is turned off in sound settings.' }); return; }
  stopNarration();
  const spoken = speechText(text);
  if (!spoken) return;
  const synth = window.speechSynthesis, u = new SpeechSynthesisUtterance(spoken);
  if (voice === undefined) voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US'; u.rate = .9; u.pitch = 1.05;
  u.onstart = () => { if (current === u) { if (watchdog) clearTimeout(watchdog); set({ id, status: 'speaking' }); } };
  u.onend = () => finish(u, { id: null, status: 'idle' });
  u.onerror = (e) => finish(u, e.error === 'interrupted' || e.error === 'canceled' ? { id: null, status: 'idle' } : { id, status: 'error', error: 'Couldn’t read that aloud. Try again.' });
  current = u; setDucked(true); set({ id, status: 'loading' });
  // If the engine never starts (some locked-down browsers), report honestly instead of a fake playing state.
  watchdog = setTimeout(() => { if (current === u && state.status === 'loading' && !synth.speaking) { synth.cancel(); finish(u, { id, status: 'error', error: 'Read aloud didn’t start on this device.' }); } }, 4000);
  synth.resume?.();
  synth.speak(u);
}
export function stopNarration() {
  if (!narrationSupported()) return;
  const was = current; current = null; if (watchdog) clearTimeout(watchdog);
  window.speechSynthesis.cancel();
  if (was || state.status !== 'idle') { setDucked(false); set({ id: null, status: 'idle' }); }
}
export function stopNarrationFor(id: string) { if (state.id === id) stopNarration(); }
