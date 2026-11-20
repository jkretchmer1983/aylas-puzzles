import { useLayoutEffect, type RefObject } from "react";

/**
 * Homepage scene drift: ONE transform driver (no CSS scroll timeline, no transitions). It writes the transform
 * straight from the browser's scroll event, which is already delivered once per rendered frame, so there is no
 * extra animation-frame hop between a scroll and its matching scene position.
 *
 * The drift depends only on scrollY and two viewport-stable lengths measured from CSS probes:
 *  - travel: the art's own overscan below the large viewport (--scene-travel), and
 *  - vh: the large-viewport height (--scene-vh = 100lvh), which Safari's collapsing toolbar does not change.
 * It never reads the page height, so catalog hydration, lazy thumbnails, fonts or an age change cannot move
 * the scene at an unchanged scroll position.
 *
 * Curve: shift = travel * (1 - e^(-y / D)), D = max(SPAN * vh, travel / RATE). It starts at exactly 0, its
 * slope is largest at the top (at most RATE of scroll speed), and it is strictly increasing with no clamp, so a
 * reversal anywhere on the page moves the scene back at once (more gently deep down: the painted overscan is finite).
 *
 * Followers: elements marked [data-scene-follow] (the top canopy over the hanging sign, the compact age bar) get
 * the SAME frame's values as CSS variables: --scene-shift (the layer's lift) and --scene-lift (scrollY - shift,
 * capped: how far content has moved relative to the art). The boot script finds followers parsed before it; the
 * hook re-collects them after hydration (layer.__sceneFollow).
 */
export const SCENE_RATE = 0.12;
export const SCENE_SPAN_VIEWPORTS = 2.5;
/** --scene-lift (content movement relative to the scene) stops updating past this; the canopy fade never needs more. */
export const SCENE_LIFT_CAP = 160;

export function sceneSpan(travel: number, viewportHeight: number) {
  return Math.max(SCENE_SPAN_VIEWPORTS * viewportHeight, travel / SCENE_RATE);
}

export function sceneShift(scrollY: number, travel: number, viewportHeight: number) {
  if (!(travel > 0) || !(viewportHeight > 0)) return 0;
  return travel * (1 - Math.exp(-Math.max(0, scrollY) / sceneSpan(travel, viewportHeight)));
}

/**
 * The driver as plain ES5 source, so the SAME code can run as an inline script in the server HTML (moving the
 * scene correctly even if the visitor scrolls before hydration) and be adopted by the hook afterwards. Only one
 * instance per layer ever exists (layer.__sceneDrift). Same math as sceneShift (asserted in tests).
 */
const DRIVER_BODY = `var layer=arguments[0];if(!layer)return function(){};if(layer.__sceneDrift)return layer.__sceneDrift;
var RATE=${SCENE_RATE},SPAN=${SCENE_SPAN_VIEWPORTS},LIFT=${SCENE_LIFT_CAP};
var tp=layer.querySelector('.commons-scene-travel'),vp=layer.querySelector('.commons-scene-vh');
var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
var T=0,V=0,last=NaN;
function measure(){T=tp?tp.offsetHeight:0;V=(vp&&vp.offsetHeight)||window.innerHeight;}
function shift(y){if(!(T>0)||!(V>0))return 0;var D=Math.max(SPAN*V,T/RATE);return T*(1-Math.exp(-Math.max(0,y)/D));}
var fl=[],lastL=NaN;
function follow(){fl=[].slice.call(document.querySelectorAll('[data-scene-follow]'));last=NaN;lastL=NaN;apply();}
function apply(){var y=window.scrollY,s=mq.matches?0:Math.round(shift(y)*100)/100,l=Math.min(LIFT,Math.round(Math.max(0,y)-s));var i;
if(s!==last){last=s;layer.style.transform='translate3d(0,'+(-s)+'px,0)';for(i=0;i<fl.length;i++)fl[i].style.setProperty('--scene-shift',s+'px');}
if(l!==lastL){lastL=l;for(i=0;i<fl.length;i++)fl[i].style.setProperty('--scene-lift',l+'px');}}
function relayout(){measure();last=NaN;lastL=NaN;apply();}
var ro=typeof ResizeObserver==='function'?new ResizeObserver(relayout):null;
if(ro){if(tp)ro.observe(tp);if(vp)ro.observe(vp);}else window.addEventListener('resize',relayout);
measure();follow();
window.addEventListener('scroll',apply,{passive:true});
if(mq.addEventListener)mq.addEventListener('change',relayout);
var stop=function(){if(ro)ro.disconnect();else window.removeEventListener('resize',relayout);window.removeEventListener('scroll',apply);if(mq.removeEventListener)mq.removeEventListener('change',relayout);layer.style.transform='';for(var i=0;i<fl.length;i++){fl[i].style.removeProperty('--scene-shift');fl[i].style.removeProperty('--scene-lift');}layer.__sceneDrift=undefined;layer.__sceneFollow=undefined;};
layer.__sceneDrift=stop;layer.__sceneFollow=follow;return stop;`;

/** Inline script placed as the LAST child of the scene layer (after its probes) in the server HTML. */
export const SCENE_DRIFT_BOOT = `(function(){${DRIVER_BODY}})(document.currentScript&&document.currentScript.parentNode);`;

type DriftLayer = HTMLElement & { __sceneDrift?: () => void; __sceneFollow?: () => void };
let startDrift: ((layer: HTMLElement) => () => void) | undefined;

/** Starts (or adopts the server-booted) driver for a layer; returns its stop function. Browser only. */
export function startSceneDrift(layer: HTMLElement): () => void {
  startDrift ??= new Function(DRIVER_BODY) as (layer: HTMLElement) => () => void;
  return (layer as DriftLayer).__sceneDrift ?? startDrift(layer);
}

export function useSceneParallax(ref: RefObject<HTMLElement | null>) {
  // Layout effect: on client navigation, a restored scroll position is applied before the first paint.
  useLayoutEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const stop = startSceneDrift(layer);
    // A server-booted driver only saw followers parsed before the scene; collect the rest now.
    (layer as DriftLayer).__sceneFollow?.();
    return stop;
  }, [ref]);
}
