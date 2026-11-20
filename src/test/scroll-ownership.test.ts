import { beforeEach, describe, expect, it } from "vitest";
import { claimMenuScroll, isInitialPageRender, resetScrollOwnershipForTests, routerShouldRestoreScroll } from "@/lib/scroll-ownership";
import { consumeMenuReturn, readMenuReturn, saveMenuReturn } from "@/lib/menu-state";

describe("scroll ownership after render", () => {
  beforeEach(() => { resetScrollOwnershipForTests(); sessionStorage.clear(); });

  it("skips the router's restore on the hydration render so an early visitor scroll is kept", () => {
    expect(isInitialPageRender()).toBe(true);
    expect(routerShouldRestoreScroll("/")).toBe(false);
    expect(isInitialPageRender()).toBe(false);
    expect(routerShouldRestoreScroll("/")).toBe(true); // later navigations restore/reset as before
    expect(routerShouldRestoreScroll("/session")).toBe(true);
  });

  it("skips exactly one menu render after the menu restored its own return position", () => {
    routerShouldRestoreScroll("/session");
    claimMenuScroll();
    expect(routerShouldRestoreScroll("/")).toBe(false);
    expect(routerShouldRestoreScroll("/")).toBe(true);
  });

  it("a menu claim never suppresses another page's restore", () => {
    routerShouldRestoreScroll("/");
    claimMenuScroll();
    expect(routerShouldRestoreScroll("/session")).toBe(true);
    expect(routerShouldRestoreScroll("/")).toBe(true);
  });

  it("the return-from-game position is restored at most once", () => {
    saveMenuReturn(4, 828);
    expect(consumeMenuReturn()).toEqual({ band: 4, scrollY: 828 });
    expect(consumeMenuReturn()).toBeUndefined();
    expect(readMenuReturn()).toBeUndefined();
  });
});
