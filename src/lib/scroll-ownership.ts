/**
 * Who moves the window scroll after a render. The router's restoration stays on for every page, with two
 * exceptions that keep deliberate scrolling intact:
 *  1. The hydration render of a full page load: the router's server-inlined script already restored (or
 *     reset) the position before first paint, so repeating it after hydration would yank any scroll the
 *     visitor made meanwhile back to the top (or to the saved value).
 *  2. A menu render whose return-from-game position the menu itself has just restored once.
 */
let firstClientRenderSeen = false;
let menuOwnsScroll = false;

/** True until the router has handled the first (hydration) render of this page load. Browser only. */
export function isInitialPageRender() {
  return !firstClientRenderSeen;
}

/** The menu restored its own saved position for the render being committed. */
export function claimMenuScroll() {
  menuOwnsScroll = true;
}

/** The router's `scrollRestoration` option. Must stay true on the server so its pre-paint script is emitted. */
export function routerShouldRestoreScroll(pathname: string): boolean {
  if (typeof window === "undefined") return true;
  const menuClaimed = menuOwnsScroll;
  menuOwnsScroll = false;
  if (!firstClientRenderSeen) {
    firstClientRenderSeen = true;
    return false;
  }
  return !(menuClaimed && pathname === "/");
}

/** Test helper. */
export function resetScrollOwnershipForTests() {
  firstClientRenderSeen = false;
  menuOwnsScroll = false;
}
