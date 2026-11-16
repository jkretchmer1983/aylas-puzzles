/* Fits the pattern patches as one compact block onto the woven cloth painted in
   the loft artwork. Anchors are fractions of each painting's natural size, so the
   projection follows the real object-fit: cover crop instead of viewport guesses. */

export type ClothArt = {
  w: number;
  h: number;
  /** [y, x] pairs along the cloth's left and right woven edges, as fractions. */
  left: [number, number][];
  right: [number, number][];
};

const px = (w: number, h: number, pts: [number, number][]): [number, number][] =>
  pts.map(([y, x]) => [y / h, x / w]);

// Traced from loft-portrait.png (1024x1536): woven cloth edges, top to bottom.
export const PORTRAIT_CLOTH: ClothArt = {
  w: 1024,
  h: 1536,
  left: px(1024, 1536, [[400, 310], [500, 285], [600, 240], [700, 210], [800, 185], [900, 155], [1000, 125], [1062, 112]]),
  right: px(1024, 1536, [[400, 710], [500, 740], [600, 775], [700, 795], [800, 815], [900, 830], [1000, 850], [1062, 860]]),
};
// Traced from loft-landscape.png (1536x1024).
export const LANDSCAPE_CLOTH: ClothArt = {
  w: 1536,
  h: 1024,
  left: px(1536, 1024, [[325, 310], [400, 275], [500, 240], [600, 205], [700, 165], [795, 120]]),
  right: px(1536, 1024, [[325, 1210], [400, 1245], [500, 1285], [600, 1325], [700, 1360], [795, 1400]]),
};

export const LOOM_ANGLE = 24;
export const LOOM_GAP = 8;
export const LOOM_LABEL = 14;
export const LOOM_MIN_PATCH = 50;
const MAX_PATCH = 160;
const MARGIN = 6;

const edgeAt = (pts: [number, number][], y: number) => {
  const first = pts[0]!, last = pts[pts.length - 1]!;
  if (y <= first[0]) return first[1];
  if (y >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [y0, x0] = pts[i - 1]!, [y1, x1] = pts[i]!;
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return last[1];
};

export type LoomFit = {
  patch: number;
  rows: number;
  perspective: number;
  /** Plane rectangle in stage (viewport) pixels before the 24deg tilt. */
  plane: { left: number; top: number; width: number; height: number };
  /** True when the rows exceed the cloth at the minimum patch size. */
  scrolls: boolean;
};

export function fitLoomPlane({
  stageW,
  stageH,
  art,
  naturalW = art.w,
  naturalH = art.h,
  zone,
  cols,
  count,
}: {
  stageW: number;
  stageH: number;
  art: ClothArt;
  naturalW?: number;
  naturalH?: number;
  /** Area left free by the title, footer controls and hanging choices. */
  zone: { left: number; top: number; right: number; bottom: number };
  cols: number;
  count: number;
}): LoomFit {
  // object-fit: cover, object-position: center top.
  const scale = Math.max(stageW / naturalW, stageH / naturalH);
  const imageLeft = (stageW - naturalW * scale) / 2;
  const toY = (f: number) => f * naturalH * scale;
  const toX = (f: number) => imageLeft + f * naturalW * scale;
  const clothTop = toY(art.left[0]![0]);
  const clothBottom = toY(art.left[art.left.length - 1]![0]);
  const leftAt = (y: number) => toX(edgeAt(art.left, y / (naturalH * scale))) + MARGIN;
  const rightAt = (y: number) =>
    Math.min(toX(edgeAt(art.right, y / (naturalH * scale))) - MARGIN, zone.right);

  const perspective = Math.min(1100, Math.max(450, stageW * 0.8));
  const a = (LOOM_ANGLE * Math.PI) / 180;
  const bottom = Math.min(zone.bottom, clothBottom - MARGIN);
  const topLimit = Math.max(zone.top, clothTop + MARGIN);
  // Projection of a point h px up the tilted plane (CSS rotateX, origin bottom,
  // perspective origin at the plane center).
  const shrink = (h: number) => perspective / (perspective + h * Math.sin(a));
  const yAt = (H: number, h: number) => bottom - H / 2 + (H / 2 - h * Math.cos(a)) * shrink(h);
  let lo = 0, hi = Math.max(0, bottom - topLimit) * 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (yAt(mid, mid) >= topLimit) lo = mid;
    else hi = mid;
  }
  const maxH = lo;
  const rows = Math.ceil(count / cols);
  const blockW = (p: number) => cols * p + (cols - 1) * LOOM_GAP;
  const blockH = (p: number) => rows * (p + LOOM_LABEL) + (rows - 1) * LOOM_GAP;
  // Allowed horizontal centres for a plane of width W and height H.
  const centres = (W: number, H: number) => {
    let min = -Infinity, max = Infinity;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const h = H * t, y = yAt(H, h), half = (W / 2) * shrink(h);
      min = Math.max(min, leftAt(y) + half);
      max = Math.min(max, rightAt(y) - half);
    }
    return { min, max };
  };
  // Keep the painted cloth centre fixed; do not trade centring for a larger tile.
  const midY = (topLimit + bottom) / 2 / (naturalH * scale);
  const preferredCentre = (toX(edgeAt(art.left, midY)) + toX(edgeAt(art.right, midY))) / 2;
  const fits = (p: number) => {
    if (blockH(p) > maxH) return false;
    const c = centres(blockW(p), blockH(p));
    return c.min <= preferredCentre && preferredCentre <= c.max;
  };
  let patch = LOOM_MIN_PATCH;
  if (fits(LOOM_MIN_PATCH)) {
    let a0 = LOOM_MIN_PATCH, b0 = MAX_PATCH;
    if (fits(MAX_PATCH)) a0 = MAX_PATCH;
    while (b0 - a0 > 1) {
      const m = Math.floor((a0 + b0) / 2);
      if (fits(m)) a0 = m;
      else b0 = m;
    }
    patch = a0;
  }
  const width = blockW(patch);
  // Dense sequences at the minimum size scroll inside the cloth.
  const height = Math.min(blockH(patch), Math.max(maxH, patch + LOOM_LABEL));
  const c = centres(width, height);
  const centre = c.min <= c.max ? Math.min(c.max, Math.max(c.min, preferredCentre)) : preferredCentre;
  return {
    patch,
    rows,
    perspective,
    plane: { left: centre - width / 2, top: bottom - height, width, height },
    scrolls: blockH(patch) > height + 0.5,
  };
}
