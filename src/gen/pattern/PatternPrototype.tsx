import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BANDS } from "../templates";
import type { PuzzleSpec } from "../types";
import { PatternInteraction } from "../Renderer";
import type { LoomState } from "./PatternLoom";

const states = new Map<string, LoomState>();
export function PatternPrototype({
  spec,
  puzzleKey,
  band,
  story,
  report,
  previous,
  next,
  fresh,
  hasPrevious,
}: {
  spec: PuzzleSpec;
  puzzleKey: string;
  band: number;
  story: string;
  report: (ok: boolean) => void;
  previous: () => void;
  next: () => void;
  fresh: () => void;
  hasPrevious: boolean;
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [muted, setMuted] = useState(true);
  const [solved, setSolved] = useState(states.get(puzzleKey)?.result === "correct");
  useEffect(() => {
    setSolved(states.get(puzzleKey)?.result === "correct");
    setHint(false);
  }, [puzzleKey]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const speak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setMuted(false);
    const utterance = new SpeechSynthesisUtterance(
      `${spec.task} Read from left to right. Pick a patch, then place it in the empty pocket. Press Check when you are ready.`,
    );
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div className="pattern-screen">
      <header className="pattern-header">
        <Link to="/" search={{ pick: 1 }} aria-label="Back to age selection">
          ←
        </Link>
        <Link to="/" search={{ pick: 1 }}>
          {BANDS[band]?.label}
        </Link>
        <h1>The Pattern Loom</h1>
        <progress value={45} max={100} aria-label="Progress placeholder" />
        <details>
          <summary aria-label="Settings">⚙ Settings</summary>
          <button
            onClick={() => {
              window.speechSynthesis?.cancel();
              setMuted(true);
            }}
          >
            Mute audio
          </button>
          <p>Motion follows your device’s reduced-motion setting.</p>
        </details>
      </header>
      <div className="pattern-task">
        <h2>{spec.task}</h2>
        <button onClick={speak} aria-label="Speak instructions">
          ♬
        </button>
        <button
          onClick={() => {
            window.speechSynthesis?.cancel();
            setMuted(true);
          }}
          aria-label="Mute instructions"
          disabled={muted}
        >
          Mute
        </button>
      </div>
      <main>
        {storyOpen && (
          <aside className="pattern-story" aria-label="Puzzle story">
            <p>{story}</p>
            <button onClick={() => setStoryOpen(false)}>Back to the loom</button>
          </aside>
        )}
        <PatternInteraction
          key={puzzleKey}
          spec={spec}
          report={report}
          saved={states.get(puzzleKey)}
          save={(state) => {
            states.set(puzzleKey, state);
            setSolved(state.result === "correct");
          }}
        />
        {hint && <aside className="pattern-story">{spec.hint}</aside>}
      </main>
      <nav className="pattern-nav" aria-label="Puzzle navigation">
        <button onClick={() => setStoryOpen((v) => !v)} aria-expanded={storyOpen}>
          Story
        </button>
        <button onClick={() => setHint((v) => !v)} aria-expanded={hint}>
          Hint
        </button>
        <button disabled={!hasPrevious} onClick={previous}>
          Previous
        </button>
        <button onClick={fresh}>New</button>
        <button className={solved ? "primary" : ""} onClick={next}>
          Next puzzle →
        </button>
      </nav>
    </div>
  );
}
