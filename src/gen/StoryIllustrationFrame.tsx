import type { ReactNode } from "react";
import frame from "@/assets/forest-game/frame-reference.webp";
import plaque from "@/assets/forest-game/title-reference.webp";

/** Reuses the current puzzle's streamed art; the frame never creates another image. */
export function StoryIllustrationFrame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="story-illustration-frame" aria-label="Puzzle story illustration">
    <div className="story-window-content">{children}</div>
    <img className="story-window-border" src={frame} alt="" aria-hidden="true" />
    <svg className="forest-growing-vines" viewBox="0 0 383 207" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M20 194Q-9 122 20 48Q37 6 112 14L279 14Q354 5 367 62L367 166Q353 203 294 194" /><path pathLength="1" d="M360 193Q387 117 360 48Q342 8 270 15L105 15Q28 6 16 65L16 165Q26 204 90 194" /></svg>
    <div className="story-title-plaque" style={{ backgroundImage: `url(${plaque})` }}><h1>{title}</h1></div>
  </section>;
}
