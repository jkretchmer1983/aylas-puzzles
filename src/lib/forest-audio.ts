/** Tiny synthesized effects: no audio downloads and no autoplay before a gesture. */
export type ForestSound = 'tap' | 'carve' | 'grow' | 'correct' | 'retry';
let context: AudioContext | undefined;
let enabled = true;
export function setForestSoundEnabled(value: boolean) { enabled = value; }
export function playForestSound(kind: ForestSound) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    context ??= new Audio();
    const ctx = context;
    void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tone = (frequency: number, offset: number, duration: number, volume: number) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .72, now + offset + duration);
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + offset); oscillator.stop(now + offset + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    if (kind === 'correct') [523,659,784,1047].forEach((note,i) => tone(note,i*.09,.28,.035));
    else if (kind === 'grow') [196,294,392].forEach((note,i) => tone(note,i*.15,.45,.018));
    else if (kind === 'retry') { tone(220,0,.13,.025); tone(174,.12,.18,.02); }
    else if (kind === 'carve') {
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .35), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,2);
      const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
      source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1400;filter.Q.value=.7;gain.gain.value=.045;
      source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    } else tone(330,0,.09,.035);
  } catch { /* Silent play stays available in restricted browsers. */ }
}
