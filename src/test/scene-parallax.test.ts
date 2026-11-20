import { describe, expect, it } from "vitest";
import { sceneShift, sceneSpan, SCENE_RATE } from "@/lib/scene-parallax";

// Phone 393x852 on the tall scene: 125px of painted overscan.
const T = 125;
const VH = 852;

describe("homepage scene drift", () => {
  it("starts at exactly 0 with no first-scroll jump", () => {
    expect(sceneShift(0, T, VH)).toBe(0);
    expect(sceneShift(-40, T, VH)).toBe(0); // iOS rubber band at the top
    for (let y = 1; y <= 10; y++) expect(sceneShift(y, T, VH)).toBeLessThan(y * SCENE_RATE + 1e-9);
  });

  it("is a pure function of scroll position: no page height input, same value on the way back", () => {
    expect(sceneShift.length).toBe(3);
    const down = [0, 300, 1200, 4000].map((y) => sceneShift(y, T, VH));
    const up = [4000, 1200, 300, 0].map((y) => sceneShift(y, T, VH)).reverse();
    expect(up).toEqual(down);
  });

  it("keeps moving deep down the page (no clamp), so a reversal there moves it back at once", () => {
    const deep = 6000;
    expect(sceneShift(deep + 50, T, VH) - sceneShift(deep, T, VH)).toBeGreaterThan(0.1);
    expect(sceneShift(20000, T, VH)).toBeLessThan(T);
  });

  it("drifts faster near the top than the old whole-page mapping (125px over a ~5900px page)", () => {
    const oldRate = 125 / (6725 - 852);
    expect(sceneShift(100, T, VH) / 100).toBeGreaterThan(2 * oldRate);
    expect(sceneShift(100, T, VH) / 100).toBeLessThanOrEqual(SCENE_RATE);
  });

  it("caps the top speed at 12% of scroll for large overscans and never uses more than the art has", () => {
    expect(sceneSpan(334, 760)).toBeCloseTo(334 / 0.12);
    expect(sceneShift(1e6, 334, 760)).toBeLessThanOrEqual(334);
  });

  it("stays still when the art has no overscan", () => {
    expect(sceneShift(2000, 0, 1024)).toBe(0);
  });
});

describe("one shared scene driver", () => {
  const layerWith = (travel: number, vh: number) => {
    const layer = document.createElement("div");
    for (const [cls, h] of [["commons-scene-travel", travel], ["commons-scene-vh", vh]] as const) {
      const probe = document.createElement("span");
      probe.className = cls;
      Object.defineProperty(probe, "offsetHeight", { value: h });
      layer.appendChild(probe);
    }
    return layer;
  };

  it("moves the layer by exactly sceneShift and never installs a second driver", async () => {
    const { startSceneDrift } = await import("@/lib/scene-parallax");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1500 });
    const layer = layerWith(T, VH);
    const stop = startSceneDrift(layer);
    const expected = Math.round(sceneShift(1500, T, VH) * 100) / 100;
    expect(layer.style.transform.replace(/\s|px/g, "")).toBe(`translate3d(0,${-expected},0)`);
    expect(startSceneDrift(layer)).toBe(stop); // adopted, not duplicated
    stop();
    expect(layer.style.transform).toBe("");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("ships the same driver as the server boot script, bound to its parent layer", async () => {
    const { SCENE_DRIFT_BOOT } = await import("@/lib/scene-parallax");
    expect(SCENE_DRIFT_BOOT).toContain("document.currentScript");
    expect(SCENE_DRIFT_BOOT).toContain(`RATE=${SCENE_RATE}`);
    expect(SCENE_DRIFT_BOOT).not.toMatch(/scrollHeight/);
  });
});
