/** WebKit may update the visual viewport before ResizeObserver/dvh catches up. */
export function watchForestViewport(element: HTMLElement, fit: (width: number, height: number) => void) {
  const measure = () => {
    const visual = window.visualViewport;
    const width = visual && visual.scale === 1 ? visual.width : window.innerWidth;
    const height = visual && visual.scale === 1 ? visual.height : window.innerHeight;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    fit(element.clientWidth, element.clientHeight);
  };
  let timers: ReturnType<typeof setTimeout>[] = [];
  const resize = () => {
    timers.forEach(clearTimeout);
    measure();
    timers = [100, 350].map(delay => setTimeout(measure, delay));
  };
  const observer = new ResizeObserver(() => {
    fit(element.clientWidth, element.clientHeight);
  });
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
