import { useState, useSyncExternalStore } from 'react';
import { getAudioStatus, testSound, unlockAudio, getAudioSettings, setAudioSettings, subscribeAudio, DEFAULT_SETTINGS, type AudioSettings as S } from '@/lib/audio/mixer';
import { englishVoices, getNarration, selectedVoice, setVoice, speak, stopNarration, subscribeNarration, subscribeVoices } from '@/lib/audio/narrator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Persistent master mute + separate voice / effects controls. */
export function AudioSettings({ className }: { className?: string }) {
  const s = useSyncExternalStore(subscribeAudio, getAudioSettings, () => DEFAULT_SETTINGS);
  const toggle = (k: keyof S) => { const v = !s[k]; setAudioSettings({ [k]: v }); if ((k === 'voice' && !v) || (k === 'muted' && v)) stopNarration(); };
  const row = (k: keyof S, label: string, on: boolean) =>
    <Button variant="game" size="game" type="button" role="switch" aria-checked={on} data-audio-ignore className="audio-switch" onClick={() => toggle(k)}><span>{label}</span><span className="audio-switch-state">{on ? 'On' : 'Off'}</span></Button>;
  const engine = useSyncExternalStore(subscribeAudio, getAudioStatus, () => 'locked' as const);
  const narration = useSyncExternalStore(subscribeNarration, getNarration, getNarration);
  const [test, setTest] = useState<string>('');
  const voiceKey = useSyncExternalStore(subscribeVoices, () => `${englishVoices().length}:${selectedVoice()?.voiceURI ?? ''}`, () => '0:');
  const voices = voiceKey.startsWith('0:') ? [] : englishVoices();
  const runTest = () => {
    setTest('Testing…');
    void testSound().then((r) => setTest(
      r.ok ? 'Sound signal confirmed. If you heard nothing, check the device volume.'
      : r.status === 'muted' ? 'Sound is muted. Turn off “Mute all sound” first.'
      : r.status === 'effects-off' ? 'Sound effects are off. Turn them on to test.'
      : r.status === 'unsupported' ? 'This browser can’t play game sounds.'
      : r.status === 'locked' ? 'The browser blocked sound. Tap “Test sound” again.'
      : 'Sound didn’t start. Tap “Test sound” again.'));
  };
  const voiceMsg = narration.id === 'voice-test' ? (narration.status === 'error' ? narration.error : narration.status === 'speaking' ? 'Speaking…' : narration.status === 'loading' ? 'Starting voice…' : '') : '';
  return <div className={cn('audio-settings', className)} role="group" aria-label="Sound settings">
    {engine !== 'running' && !s.muted && <Button variant="game" size="game" type="button" data-audio-ignore className="audio-action audio-enable" onClick={() => { void unlockAudio(); }}>
      {engine === 'unsupported' ? 'Sound not supported here' : 'Enable sound'}</Button>}
    <div className="audio-test-row">
      <Button variant="game" size="game" type="button" data-audio-ignore className="audio-action" onClick={runTest}>Test sound</Button>
      <Button variant="game" size="game" type="button" data-audio-ignore className="audio-action" onClick={() => speak('voice-test', 'Hello Ayla! This is your puzzle voice.')}>Test voice</Button>
    </div>
    <p className="audio-status" role="status" aria-live="polite">{voiceMsg || test || (engine === 'running' ? 'Sound is on.' : engine === 'unsupported' ? 'This browser can’t play game sounds.' : s.muted ? 'All sound is muted.' : 'Sound is waiting for a tap.')}</p>
    {voices.length > 1 && <label className="audio-volume"><span>Reading voice</span>
      <select data-audio-ignore value={selectedVoice()?.voiceURI ?? ''} onChange={(e) => { setVoice(e.target.value); speak('voice-test', 'Hello Ayla! This is your puzzle voice.'); }}>
        {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
      </select></label>}
    {row('muted', 'Mute all sound', s.muted)}
    {row('voice', 'Read-aloud voice', s.voice)}
    {row('effects', 'Sound effects', s.effects)}
  </div>;
}
