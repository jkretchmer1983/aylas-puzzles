let context: AudioContext | null = null;
/** Gesture-triggered quiet string/release sound. No autoplay or audio downloads. */
export function releaseSound() {
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    context ??= new Audio(); const ctx = context; void ctx.resume().catch(()=>{});
    const tone=ctx.createOscillator(),gain=ctx.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(280,ctx.currentTime);
    tone.frequency.exponentialRampToValueAtTime(95,ctx.currentTime+.24);
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.035,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.3);
    tone.connect(gain);gain.connect(ctx.destination);tone.start();tone.stop(ctx.currentTime+.31);
    tone.onended=()=>{tone.disconnect();gain.disconnect()};
  } catch { /* Muted/restricted browser play remains available. */ }
}
