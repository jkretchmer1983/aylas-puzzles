import { useState, useSyncExternalStore } from 'react';
import { getAudioStatus, testSound, unlockAudio, getAudioSettings, setAudioSettings, subscribeAudio, DEFAULT_SETTINGS, type AudioSettings as S } from '@/lib/audio/mixer';
import { getNarration, speak, stopNarration, subscribeNarration } from '@/lib/audio/narrator';
import { cn } from '@/lib/utils';

/** Persistent master mute + separate voice / effects / music controls. */
export function AudioSettings({ className }: { className?: string }) {
  const s = useSyncExternalStore(subscribeAudio, getAudioSettings, () => DEFAULT_SETTINGS);
  const toggle = (k: keyof Omit<S, 'musicVolume'>) => { const v = !s[k]; setAudioSettings({ [k]: v }); if ((k === 'voice' && !v) || (k === 'muted' && v)) stopNarration(); };
  const row = (k: keyof Omit<S, 'musicVolume'>, label: string, on: boolean) =>
    <button type="button" role="switch" aria-checked={on} data-audio-ignore className="audio-switch" onClick={() => toggle(k)}><span>{label}</span><span className="audio-switch-state">{on ? 'On' : 'Off'}</span></button>;
  const engine = useSyncExternalStore(subscribeAudio, getAudioStatus, () => 'locked' as const);
  const narration = useSyncExternalStore(subscribeNarration, getNarration, getNarration);
  const [test, setTest] = useState<string>('');
  const runTest = () => {
    setTest('Testing…');
    void testSound().then((r) => setTest(
      r.ok ? 'Sound is playing. If you heard nothing, check the device volume and silent switch.'
      : r.status === 'muted' ? 'Sound is muted. Turn off “Mute all sound” first.'
      : r.status === 'effects-off' ? 'Sound effects are off. Turn them on to test.'
      : r.status === 'unsupported' ? 'This browser can’t play game sounds.'
      : r.status === 'locked' ? 'The browser blocked sound. Tap “Test sound” again.'
      : 'Sound didn’t start. Tap “Test sound” again.'));
  };
  const voiceMsg = narration.id === 'voice-test' ? (narration.status === 'error' ? narration.error : narration.status === 'speaking' ? 'Speaking…' : narration.status === 'loading' ? 'Starting voice…' : '') : '';
  return <div className={cn('audio-settings', className)} role="group" aria-label="Sound settings">
    {engine !== 'running' && !s.muted && <button type="button" data-audio-ignore className="audio-action audio-enable" onClick={() => { void unlockAudio(); }}>
      {engine === 'unsupported' ? 'Sound not supported here' : 'Enable sound'}</button>}
    <div className="audio-test-row">
      <button type="button" data-audio-ignore className="audio-action" onClick={runTest}>Test sound</button>
      <button type="button" data-audio-ignore className="audio-action" onClick={() => speak('voice-test', 'Hello Ayla! This is your puzzle voice.')}>Test voice</button>
    </div>
    <p className="audio-status" role="status" aria-live="polite">{voiceMsg || test || (engine === 'running' ? 'Sound is on.' : engine === 'unsupported' ? 'This browser can’t play game sounds.' : s.muted ? 'All sound is muted.' : 'Sound is waiting for a tap.')}</p>
    {row('muted', 'Mute all sound', s.muted)}
    {row('voice', 'Read-aloud voice', s.voice)}
    {row('effects', 'Sound effects', s.effects)}
    {row('music', 'Music', s.music)}
    <label className="audio-volume"><span>Music volume</span>
      <input type="range" min={0} max={1} step={.05} value={s.musicVolume} disabled={!s.music || s.muted} data-audio-ignore onChange={(e) => setAudioSettings({ musicVolume: Number(e.target.value) })} />
    </label>
  </div>;
}
