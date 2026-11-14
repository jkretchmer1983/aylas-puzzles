import type { ReactNode } from "react";
import frame from "@/assets/forest/story-window.png";

/** Reuses the current puzzle's streamed art; the frame never creates another image. */
export function StoryIllustrationFrame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="story-illustration-frame" aria-label="Puzzle story illustration">
    <div className="story-window-content">{children}</div>
    <img className="story-window-border" src={frame} alt="" aria-hidden="true" />
    <div className="story-title-plaque"><h1>{title}</h1></div>
  </section>;
}