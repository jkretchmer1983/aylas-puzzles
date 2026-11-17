import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { BANDS, generate, templatesFor } from '@/gen/templates';
import { PuzzleBody } from '@/gen/Renderer';
import { ReadAloud } from '@/components/ReadAloud';
import { narrationPayload, setVoice, stopNarration } from '@/lib/audio/narrator';
import { speechText } from '@/lib/audio/speech-text';
import { useSceneAudio } from '@/lib/audio/use-scene-audio';
import { profileFor } from '@/lib/audio/profiles';

const effects = vi.hoisted(() => vi.fn());
vi.mock('@/lib/audio/mixer', async (original) => ({ ...await original<object>(), playEffect: effects }));
afterEach(() => { stopNarration(); cleanup(); vi.unstubAllGlobals(); effects.mockClear(); });

function Game({ template, band, world }: { template: string; band: number; world: boolean }) {
  const spec = generate(template, band, 42), audio = useSceneAudio(template, `${world}:${template}`);
  const content = { title: spec.title, story: spec.story, task: spec.task };
  return <main onClickCapture={audio.onClickCapture}>
    <ReadAloud group={template} content={content} label="story" />
    <ReadAloud group={template} content={content} label="instructions" />
    <div className={world ? 'sw-game-area' : 'puzzle-sheet'}>
      <PuzzleBody spec={spec} storyWorld={world} report={(ok) => audio.effect(ok ? 'success' : 'retry')} />
    </div>
  </main>;
}

for (const world of [false, true]) for (const template of templatesFor(6).concat(templatesFor(0), templatesFor(1), templatesFor(2)).filter((t, i, all) => all.findIndex((v) => v.id === t.id) === i)) {
  it(`${world ? '/story-world' : '/play'} ${template.id}: both current payloads, stable voice and real piece effects`, () => {
    const voice = { name: 'Samantha', voiceURI: 'sam', lang: 'en-US', localService: true };
    const calls: { text: string; voice?: unknown; onstart?: () => void; onend?: () => void }[] = [];
    vi.stubGlobal('speechSynthesis', { getVoices: () => [voice], cancel: vi.fn(), speak: (u: typeof calls[number]) => { calls.push(u); }, addEventListener: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    setVoice('sam');
    const band = BANDS.find((b) => templatesFor(b.id).some((t) => t.id === template.id))?.id ?? 0;
    const spec = generate(template.id, band, 42);
    const view = render(<Game world={world} template={template.id} band={band} />);
    const read = view.container.querySelectorAll('[data-read-payload]');
    const expected = narrationPayload({ title: spec.title, story: spec.story, task: spec.task });
    expect(read).toHaveLength(2);
    for (const button of read) {
      expect(button.getAttribute('data-read-payload')).toBe(expected);
      act(() => stopNarration()); calls.length = 0; fireEvent.click(button);
      for (let i = 0; i < calls.length; i++) { act(() => { calls[i]?.onstart?.(); calls[i]?.onend?.(); }); }
      expect(calls.map((u) => u.text).join(' ')).toBe(speechText(expected));
      expect(calls.every((u) => u.voice === voice)).toBe(true);
    }
    const piece = view.container.querySelector('.puzzle-sheet button:not([disabled]),.sw-game-area button:not([disabled])');
    expect(piece).not.toBeNull(); if (!piece) return;
    effects.mockClear(); fireEvent.click(piece);
    expect(effects).toHaveBeenCalledWith(profileFor(template.id), 'place');
  });
}