export type ForestLayout = { mode: 'phone' | 'portrait-wide' | 'landscape'; width: number; height: number; scale: number };
/** Choose by available shape, including wider phones and tablet split views. */
export function fitForestLayout(width: number, height: number): ForestLayout {
  const wide = width >= 390 && width / Math.max(height, 1) >= .58;
  const landscape = width >= 600 && width / Math.max(height, 1) >= 1.15;
  const canvas = landscape ? { mode: 'landscape' as const, width: 1280, height: 720 } : wide ? { mode: 'portrait-wide' as const, width: 768, height: 1100 } : { mode: 'phone' as const, width: 393, height: 852 };
  return { ...canvas, scale: Math.min(width / canvas.width, height / canvas.height) };
}
