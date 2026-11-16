export type RobotSound = "pickup" | "drop" | "turn" | "move" | "deliver" | "success" | "brake";
let context: AudioContext | undefined;
let enabled = true;
export function setRobotSoundEnabled(value: boolean) { enabled = value; }

export function playRobotSound(kind: RobotSound) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    context ??= new Audio();
    const ctx = context;
    void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tone = (frequency: number, offset: number, duration: number, volume: number, type: OscillatorType = "sine") => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * .82), now + offset + duration);
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + offset); oscillator.stop(now + offset + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    if (kind === "success") [523, 659, 784, 1047].forEach((n, i) => tone(n, i * .08, .26, .028));
    else if (kind === "deliver") [392, 587, 784].forEach((n, i) => tone(n, i * .055, .18, .022));
    else if (kind === "brake") { tone(150, 0, .18, .024, "sawtooth"); tone(105, .12, .2, .018, "square"); }
    else if (kind === "move") tone(180, 0, .12, .012, "triangle");
    else if (kind === "turn") tone(280, 0, .09, .014, "triangle");
    else if (kind === "pickup") tone(420, 0, .07, .018);
    else tone(320, 0, .08, .02);
  } catch { /* Restricted browsers retain silent play. */ }
}
