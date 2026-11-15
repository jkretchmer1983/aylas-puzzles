import type { ReactNode } from "react";
import frame from "@/assets/forest-game/frame-reference.webp";
import plaque from "@/assets/forest-game/title-reference.webp";

/** HTML background slices avoid WebKit SVG viewport overflow inside scaled grids.
 * Reuses the current puzzle's streamed art; the frame never creates another image. */
export function StoryIllustrationFrame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="story-illustration-frame" aria-label="Puzzle story illustration">
    <div className="story-window-content">{children}</div>
    <div className="story-branch-overlay" aria-hidden="true">
      {[
        [0, 0, 200, 200, 1, 1], [200, 0, 1306, 200, 1, 2], [1506, 0, 200, 200, 1, 3],
        [0, 200, 200, 522, 2, 1], [1506, 200, 200, 522, 2, 3],
        [0, 722, 200, 200, 3, 1], [200, 722, 1306, 200, 3, 2], [1506, 722, 200, 200, 3, 3],
      ].map(([x, y, width, height, row, column]) => <div key={`${row}-${column}`} className="story-branch-slice" style={{
        gridRow:row, gridColumn:column,
        backgroundImage:`url(${frame})`,
        backgroundSize:`${1706 / width * 100}% ${922 / height * 100}%`,
        backgroundPosition:`${x / (1706 - width) * 100}% ${y / (922 - height) * 100}%`,
      }} />)}
    </div>
    <svg className="forest-growing-vines" viewBox="0 0 383 207" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M20 194Q-9 122 20 48Q37 6 112 14L279 14Q354 5 367 62L367 166Q353 203 294 194" /><path pathLength="1" d="M360 193Q387 117 360 48Q342 8 270 15L105 15Q28 6 16 65L16 165Q26 204 90 194" /></svg>
    <div className="story-title-plaque" style={{ backgroundImage: `url(${plaque})` }}><h1>{title}</h1></div>
  </section>;
}
