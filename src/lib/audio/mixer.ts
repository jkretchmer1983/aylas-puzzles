/** One Web Audio output for finite game effects and online narration. No music or looping sources. */
import { getAudioSettings, subscribeAudioSettings } from "./settings";

type AudioCtor = typeof AudioContext;
let context: AudioContext | null = null;
let master: GainNode | null = null;
let effects: GainNode | null = null;
let narration: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let ducked = false;
let installed = false;
let silentPlayed = false;
let silentUrl: string | null = null;

function audioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null;
}

export function setPlaybackSession() {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch { /* Older Safari does not expose audioSession. */ }
}

function silentClipUrl() {
  if (silentUrl) return silentUrl;
  const rate = 8000, samples = 800;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + samples, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); write(36, "data"); view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentUrl;
}

function applyLevels() {
  if (!context || !master || !effects || !narration) return;
  const settings = getAudioSettings();
  const now = context.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.025);
  effects.gain.setTargetAtTime(settings.effects * (ducked ? 0.25 : 1), now, 0.025);
  narration.gain.setTargetAtTime(settings.narration, now, 0.025);
}

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  subscribeAudioSettings(applyLevels);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void context?.suspend().catch(() => {});
  });
}

/** Call synchronously from a real tap so Safari unlocks the same context used later by narration. */
export function unlockAudio(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  install();
  setPlaybackSession();
  try {
    if (!context || context.state === "closed") {
      context = new Ctor();
      master = context.createGain();
      effects = context.createGain();
      narration = context.createGain();
      analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      effects.connect(master);
      narration.connect(master);
      master.connect(analyser);
      analyser.connect(context.destination);
      applyLevels();
    }
    if (context.state !== "running") void context.resume().catch(() => {});
  } catch {
    return null;
  }
  if (!silentPlayed) {
    silentPlayed = true;
    try {
      const clip = new Audio(silentClipUrl());
      clip.setAttribute("playsinline", "");
      void clip.play().catch(() => { silentPlayed = false; });
    } catch { silentPlayed = false; }
  }
  return context;
}

export async function resumeAudio(): Promise<AudioContext> {
  const ctx = unlockAudio();
  if (!ctx) throw new Error("Audio playback is not supported by this browser.");
  if (ctx.state !== "running") await ctx.resume();
  if (ctx.state !== "running") throw new Error("Audio is paused. Tap the speaker to try again.");
  return ctx;
}

export function effectsBus(): { ctx: AudioContext; out: GainNode } | null {
  const settings = getAudioSettings();
  if (settings.muted || settings.effects === 0) return null;
  const ctx = unlockAudio();
  if (!ctx || !effects) return null;
  applyLevels();
  return { ctx, out: effects };
}

export function narrationBus(): { ctx: AudioContext; out: GainNode } | null {
  const settings = getAudioSettings();
  if (settings.muted || settings.narration === 0) return null;
  const ctx = unlockAudio();
  if (!ctx || !narration) return null;
  applyLevels();
  return { ctx, out: narration };
}

export function setEffectsDucked(value: boolean) { ducked = value; applyLevels(); }
export const audioContextState = () => context?.state ?? "none";

/** Test-only reset; gameplay uses the single persistent context. */
export function resetMixerForTests() {
  try { void context?.close(); } catch { /* Already closed. */ }
  context = null; master = null; effects = null; narration = null; analyser = null;
  silentPlayed = false; ducked = false;
}

/** RMS at the shared output, used by native-browser QA rather than mocked speech callbacks. */
export function mixerLevel() {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const sample of data) sum += sample * sample;
  return Math.sqrt(sum / data.length);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __aylaAudio?: unknown }).__aylaAudio = { mixerLevel, state: audioContextState };
}
