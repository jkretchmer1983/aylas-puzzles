/** Persistent narration and effects preferences. Music is intentionally not part of this settings model. */
export type AudioSettings = { muted: boolean; narration: number; effects: number };
export const AUDIO_SETTINGS_KEY = "ayla-audio-settings-v2";
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { muted: false, narration: 1, effects: 0.7 };

let current: AudioSettings | null = null;
const listeners = new Set<(settings: AudioSettings) => void>();
const clamp = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.min(1, Math.max(0, value))
  : fallback;

function load(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) || localStorage.getItem("ayla-audio-settings-v1") || "null");
    if (raw && typeof raw === "object") {
      return {
        muted: raw.muted === true,
        narration: clamp(raw.narration, DEFAULT_AUDIO_SETTINGS.narration),
        effects: clamp(raw.effects, DEFAULT_AUDIO_SETTINGS.effects),
      };
    }
    return {
      ...DEFAULT_AUDIO_SETTINGS,
      narration: localStorage.getItem("ayla-take-muted") === "true" ? 0 : DEFAULT_AUDIO_SETTINGS.narration,
      effects: localStorage.getItem("forest-sound") === "off" ? 0 : DEFAULT_AUDIO_SETTINGS.effects,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function getAudioSettings(): AudioSettings {
  return current ??= load();
}

export function setAudioSettings(patch: Partial<AudioSettings>) {
  const previous = getAudioSettings();
  const next: AudioSettings = {
    muted: typeof patch.muted === "boolean" ? patch.muted : previous.muted,
    narration: clamp(patch.narration, previous.narration),
    effects: clamp(patch.effects, previous.effects),
  };
  current = next;
  try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Private mode still plays. */ }
  listeners.forEach((listener) => listener(next));
}

let storageWired = false;
export function subscribeAudioSettings(listener: (settings: AudioSettings) => void) {
  if (!storageWired && typeof window !== "undefined") {
    storageWired = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== AUDIO_SETTINGS_KEY) return;
      current = null;
      const next = getAudioSettings();
      listeners.forEach((fn) => fn(next));
    });
  }
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetAudioSettingsCache() { current = null; }
