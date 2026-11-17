import { useCallback, useEffect, useRef } from 'react';
import { playEffect, stopEffects, type EffectKind } from './mixer';
import { stopNarration } from './narrator';
import { profileFor } from './profiles';

/** Scene audio for one game screen: effects only; cleans up on scene change/unmount. */
export function useSceneAudio(template: string | undefined, sceneKey: string) {
  const profile = profileFor(template ?? '');
  const ref = useRef(profile); ref.current = profile;
  useEffect(() => () => { stopNarration(); stopEffects(); }, [profile.id, sceneKey]);
  const effect = useCallback((kind: EffectKind) => playEffect(ref.current, kind), []);
  /** Click-capture: a soft action sound for real button taps inside the game (never pointer moves). */
  const onClickCapture = useCallback((event: React.MouseEvent) => {
    const control = (event.target as HTMLElement).closest('button,a,summary,[role=button]');
    if (!control || control.hasAttribute('disabled') || control.closest('[inert]') || control.closest('[data-audio-ignore],.pz-check,.adventure-begin')) return;
    playEffect(ref.current, control.closest('.puzzle-sheet,.sw-game-area') ? 'place' : 'action');
  }, []);
  return { profile, effect, onClickCapture };
}
