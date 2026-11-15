export type ForestLayout = { mode: 'phone' | 'portrait-wide'; width: number; height: number; scale: number };
/** Choose by available shape, including wider phones and tablet split views. */
export function fitForestLayout(width: number, height: number): ForestLayout {
  const wide = width >= 390 && width / Math.max(height, 1) >= .58;
  const canvas = wide ? { mode: 'portrait-wide' as const, width: 768, height: 1100 } : { mode: 'phone' as const, width: 393, height: 852 };
  return { ...canvas, scale: Math.min(width / canvas.width, height / canvas.height) };
}
