import { useCallback, useEffect, useRef } from 'react';
import { playEffect, releaseMusic, startMusic, unlockAudio, type EffectKind } from './mixer';
import { stopNarration } from './narrator';
import { profileFor } from './profiles';

/** Scene audio for one game screen: music starts on the first real tap; cleans up on scene change/unmount. */
export function useSceneAudio(template: string | undefined, sceneKey: string) {
  const profile = profileFor(template ?? '');
  const ref = useRef(profile); ref.current = profile;
  const gestured = useRef(false);
  useEffect(() => {
    if (gestured.current) startMusic(profile);
    return () => { stopNarration(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, sceneKey]);
  useEffect(() => () => releaseMusic(), []);
  useEffect(() => {
    // iOS only treats click/touchend/keydown as user activation (not pointerdown), so unlock there.
    const evs = ['touchend', 'click', 'keydown'] as const;
    const first = () => { gestured.current = true; void unlockAudio(); startMusic(ref.current); evs.forEach((e) => window.removeEventListener(e, first, true)); };
    evs.forEach((e) => window.addEventListener(e, first, true));
    return () => evs.forEach((e) => window.removeEventListener(e, first, true));
  }, []);
  const effect = useCallback((kind: EffectKind) => playEffect(ref.current, kind), []);
  /** Click-capture: a soft action sound for real button taps inside the game (never pointer moves). */
  const onClickCapture = useCallback((event: React.MouseEvent) => {
    const control = (event.target as HTMLElement).closest('button,a,summary,[role=button]');
    if (!control || control.hasAttribute('disabled') || control.closest('[data-audio-ignore],.pz-check,.adventure-begin')) return;
    playEffect(ref.current, control.closest('.puzzle-sheet,.sw-game-area') ? 'place' : 'action');
  }, []);
  return { profile, effect, onClickCapture };
}
