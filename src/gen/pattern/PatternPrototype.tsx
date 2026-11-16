import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Settings,
  Volume2,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { BANDS } from "../templates";
import type { PuzzleSpec } from "../types";
import { PatternInteraction } from "../Renderer";
import type { LoomState } from "./PatternLoom";


const states = new Map<string, LoomState>();
const started = new Set<string>();
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
  const [storyOpen, setStoryOpen] = useState(!started.has(puzzleKey));
  const [feeding, setFeeding] = useState(false);
  const [hint, setHint] = useState(false);
  const [sound, setSound] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [motion, setMotion] = useState(false);
  const [solved, setSolved] = useState(states.get(puzzleKey)?.result === "correct");
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setSolved(states.get(puzzleKey)?.result === "correct");
    setHint(false);
    setStoryOpen(!started.has(puzzleKey));
  }, [puzzleKey]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      if (startTimer.current) clearTimeout(startTimer.current);
    },
    [],
  );
  const save = useCallback(
    (state: LoomState) => {
      states.set(puzzleKey, state);
      setSolved(state.result === "correct");
    },
    [puzzleKey],
  );
  const speak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(
      `${spec.task} Start at patch one. Read each row from left to right, then the next row. Pick a patch and place it in the empty pocket. Press Check when you are ready.`,
    );
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };
  const start = () => {
    started.add(puzzleKey);
    setStoryOpen(false);
    setFeeding(true);
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => setFeeding(false), 800);
  };
  return (
    <div
      className={`pattern-screen ${storyOpen ? "pattern-intro" : ""} ${feeding ? "pattern-feeding" : ""} ${motion ? "pattern-still" : ""} ${solved ? "pattern-complete" : ""}`}
    >
      <picture className="loom-world" aria-hidden="true">
        <source
          media="(orientation: landscape) and (min-width: 700px)"
          srcSet="/loom/loft-landscape.png"
        />
        <img src="/loom/loft-portrait.png" alt="" draggable={false} />
      </picture>
      <header className="pattern-header">
        <Link
          className="loom-control loom-back"
          to="/"
          search={{ pick: 1 }}
          aria-label="Back to age selection"
        >
          <ArrowLeft />
        </Link>
        <Link
          className="loom-control loom-age"
          to="/"
          search={{ pick: 1 }}
          aria-label={`Choose age, ${BANDS[band]?.label}`}
        >
          <span>Age</span>
          {BANDS[band]?.label.replace("Ages ", "")}
        </Link>
        <h1 className="sr-only">The Pattern Loom</h1>
        <div
          className="loom-progress"
          role="progressbar"
          aria-label="Progress placeholder"
          aria-valuenow={45}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span />
        </div>
        <details ref={settings} className="loom-settings">
          <summary className="loom-control" aria-label="Settings">
            <Settings />
          </summary>
          <div className="loom-settings-panel">
            <label>
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />{" "}
              Sound effects
            </label>
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                setSpeaking(false);
                setSound(false);
              }}
            >
              Mute all audio
            </button>
            <label>
              <input
                type="checkbox"
                checked={motion}
                onChange={(e) => setMotion(e.target.checked)}
              />{" "}
              Reduce motion
            </label>
            <p>Also follows your device’s reduced-motion setting.</p>
            <button
              onClick={() => {
                if (settings.current) settings.current.open = false;
              }}
            >
              Close settings
            </button>
          </div>
        </details>
      </header>
      <div className="pattern-task">
        <button
          onClick={
            speaking
              ? () => {
                  window.speechSynthesis?.cancel();
                  setSpeaking(false);
                }
              : speak
          }
          aria-label={speaking ? "Stop spoken instructions" : "Speak instructions"}
        >
          <Volume2 />
        </button>
        <h2>{spec.task === "Which one comes next?" ? "Which patch comes next?" : spec.task}</h2>
      </div>
      <main inert={storyOpen || hint ? true : undefined}>
        <PatternInteraction
          key={puzzleKey}
          spec={spec}
          report={report}
          saved={states.get(puzzleKey)}
          save={save}
          sound={sound}
        />
      </main>
      {storyOpen && (
        <section
          className="pattern-story"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loom-story-title"
        >
          <BookOpen aria-hidden="true" />
          <h2 id="loom-story-title">A little story at the loom</h2>
          <p>{story}</p>
          <button className="loom-control" onClick={start}>
            Let’s weave →
          </button>
        </section>
      )}
      {hint && (
        <section className="pattern-story" role="dialog" aria-modal="true" aria-label="Hint">
          <Lightbulb aria-hidden="true" />
          <h2>A little hint</h2>
          <p>{spec.hint}</p>
          <button className="loom-control" onClick={() => setHint(false)}>
            Back to the loom
          </button>
        </section>
      )}
      <nav className="pattern-nav" aria-label="Puzzle navigation">
        <button
          className="loom-control"
          onClick={() => {
            setHint(false);
            setStoryOpen((v) => !v);
          }}
          aria-expanded={storyOpen}
        >
          <BookOpen />
          <span>Story</span>
        </button>
        <button
          className="loom-control"
          onClick={() => {
            setStoryOpen(false);
            setHint((v) => !v);
          }}
          aria-expanded={hint}
        >
          <Lightbulb />
          <span>Hint</span>
        </button>
        <button className="loom-control" disabled={!hasPrevious} onClick={previous}>
          <ChevronLeft />
          <span>Previous</span>
        </button>
        <button
          className="loom-control"
          onClick={() => {
            setStoryOpen(false);
            setHint(false);
            fresh();
          }}
        >
          <RotateCcw />
          <span>New</span>
        </button>
        <button className={`loom-control ${solved ? "primary" : ""}`} onClick={next}>
          <span>{solved ? "Next puzzle" : "Next"}</span>
          <ChevronRight />
        </button>
      </nav>
    </div>
  );
}
