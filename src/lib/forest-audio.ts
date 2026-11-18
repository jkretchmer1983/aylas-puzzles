import { effectsBus } from "@/lib/audio/mixer";
import { setAudioSettings } from "@/lib/audio/settings";
import { isHostSuppressed } from "@/host/child-bridge";

/** Finite forest wood, chisel and success effects through the shared Web Audio output. */
export type ForestSound = "tap" | "carve" | "grow" | "correct" | "retry";

/** Compatibility for existing focused tests and older callers. */
export function setForestSoundEnabled(value: boolean) { setAudioSettings({ effects: value ? 0.7 : 0 }); }

export function playForestSound(kind: ForestSound) {
  // Hidden/paused hub preload: play nothing (user sound settings stay untouched).
  if (isHostSuppressed()) return;
  if (typeof window === "undefined") return;
  try {
    const bus = effectsBus();
    if (!bus) return;
    const { ctx, out } = bus;
    const now = ctx.currentTime;
    const tone = (frequency: number, offset: number, duration: number, volume: number, glide = 0.72, type: OscillatorType = "sine") => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * glide, now + offset + duration);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain); gain.connect(out);
      oscillator.start(now + offset); oscillator.stop(now + offset + duration + 0.01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    if (kind === "correct") [523, 659, 784, 1047].forEach((note, i) => tone(note, i * 0.09, 0.28, 0.06, 1.01, "triangle"));
    else if (kind === "grow") [196, 294, 392].forEach((note, i) => tone(note, i * 0.15, 0.45, 0.035, 1.02));
    else if (kind === "retry") { tone(220, 0, 0.13, 0.045); tone(174, 0.12, 0.18, 0.035); }
    else if (kind === "carve") {
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2);
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = 1400; filter.Q.value = 0.7; gain.gain.value = 0.08;
      source.connect(filter); filter.connect(gain); gain.connect(out); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } else tone(330, 0, 0.09, 0.06, 0.82, "triangle");
  } catch { /* Audio restrictions never block the puzzle. */ }
}
