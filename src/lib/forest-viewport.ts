/** Measure the CSS viewport itself: iOS embedded browsers can report stale
 * visualViewport dimensions during rotation. Never freeze the element to them. */
export function watchForestViewport(element: HTMLElement, fit: (width: number, height: number) => void) {
  const measure = () => fit(element.clientWidth, element.clientHeight);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const resize = () => {
    timers.forEach(clearTimeout);
    measure();
    timers = [100, 350, 800].map(delay => setTimeout(measure, delay));
  };
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();
  return () => {
    timers.forEach(clearTimeout);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  };
}
