import { useSyncExternalStore } from 'react';
import { getAudioSettings, setAudioSettings, subscribeAudio, DEFAULT_SETTINGS, type AudioSettings as S } from '@/lib/audio/mixer';
import { stopNarration } from '@/lib/audio/narrator';
import { cn } from '@/lib/utils';

/** Persistent master mute + separate voice / effects / music controls. */
export function AudioSettings({ className }: { className?: string }) {
  const s = useSyncExternalStore(subscribeAudio, getAudioSettings, () => DEFAULT_SETTINGS);
  const toggle = (k: keyof Omit<S, 'musicVolume'>) => { const v = !s[k]; setAudioSettings({ [k]: v }); if ((k === 'voice' && !v) || (k === 'muted' && v)) stopNarration(); };
  const row = (k: keyof Omit<S, 'musicVolume'>, label: string, on: boolean) =>
    <button type="button" role="switch" aria-checked={on} data-audio-ignore className="audio-switch" onClick={() => toggle(k)}><span>{label}</span><span className="audio-switch-state">{on ? 'On' : 'Off'}</span></button>;
  return <div className={cn('audio-settings', className)} role="group" aria-label="Sound settings">
    {row('muted', 'Mute all sound', s.muted)}
    {row('voice', 'Read-aloud voice', s.voice)}
    {row('effects', 'Sound effects', s.effects)}
    {row('music', 'Music', s.music)}
    <label className="audio-volume"><span>Music volume</span>
      <input type="range" min={0} max={1} step={.05} value={s.musicVolume} disabled={!s.music || s.muted} data-audio-ignore onChange={(e) => setAudioSettings({ musicVolume: Number(e.target.value) })} />
    </label>
  </div>;
}
