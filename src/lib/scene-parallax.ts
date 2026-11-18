import { useEffect, type RefObject } from "react";

/** Most the courtyard ever drifts; must match --scene-travel-max in puzzle-commons.css. */
export const SCENE_OVERSCAN = 400;
/** Least drift kept after part of the overscan is spent lifting the characters; matches --scene-travel-min. */
export const SCENE_TRAVEL_MIN = 250;

/**
 * Bounded parallax: the background moves `travel` px in total across the page's FULL scroll extent,
 * so it never runs out of art early however long the catalog is.
 */
export function sceneShift(scrollY: number, scrollHeight: number, viewportHeight: number, travel = SCENE_OVERSCAN) {
  const range = scrollHeight - viewportHeight;
  if (!(range > 0)) return 0;
  const progress = Math.min(1, Math.max(0, scrollY / range));
  return Math.round(progress * travel * 10) / 10;
}

/** True when the browser drives the drift itself from CSS (animation-timeline: scroll()) on the compositor. */
export function cssDrivesSceneDrift() {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: scroll()");
}

/**
 * Fallback driver for browsers without scroll-driven animations. Metrics (travel, large-viewport height,
 * page height) are measured only when layout changes, never per scroll, and use the layer's own large-viewport
 * height so Safari's collapsing toolbar cannot rescale the motion. No transitions: each frame sets the exact target.
 */
export function useSceneParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const layer = ref.current;
    if (!layer || cssDrivesSceneDrift()) return;
    const probe = layer.querySelector<HTMLElement>(".commons-scene-travel");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let travel = SCENE_OVERSCAN;
    let viewport = window.innerHeight;
    let pageHeight = document.documentElement.scrollHeight;
    let last = Number.NaN;
    const measure = () => {
      travel = probe?.offsetHeight || SCENE_OVERSCAN;
      viewport = Math.max(window.innerHeight, layer.offsetHeight - travel);
      pageHeight = document.documentElement.scrollHeight;
    };
    const apply = () => {
      frame = 0;
      const shift = reduced.matches ? 0 : sceneShift(window.scrollY, pageHeight, viewport, travel);
      if (shift === last) return;
      last = shift;
      layer.style.transform = `translate3d(0, ${-shift}px, 0)`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    const relayout = () => { measure(); schedule(); };
    const observer = new ResizeObserver(relayout);
    observer.observe(document.body);
    measure();
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", relayout);
    reduced.addEventListener?.("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", relayout);
      reduced.removeEventListener?.("change", schedule);
      layer.style.transform = "";
    };
  }, [ref]);
}
