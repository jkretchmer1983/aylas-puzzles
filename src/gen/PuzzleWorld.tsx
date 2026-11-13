import type { ReactNode } from "react";
import wood from "@/assets/tree-workshop.jpg";
import river from "@/assets/river-slate.jpg";
import bench from "@/assets/makers-workbench.jpg";
import linen from "@/assets/picnic-linen.jpg";

const WORLDS: Record<string, { surface: string; material: string; image: string }> = {
  count: { surface: "basket", material: "linen", image: linen },
  pattern: { surface: "beads", material: "wood", image: wood },
  odd: { surface: "specimens", material: "bench", image: bench },
  add: { surface: "harvest", material: "linen", image: linen },
  take: { surface: "bakery", material: "linen", image: linen },
  size: { surface: "rail", material: "wood", image: wood },
  sequence: { surface: "stepping-stones", material: "stone", image: river },
  sudoku: { surface: "tree-grid", material: "wood", image: wood },
  lineup: { surface: "finish-line", material: "bench", image: bench },
  coins: { surface: "treasure", material: "wood", image: wood },
  sides: { surface: "workshop", material: "bench", image: bench },
  balance: { surface: "market", material: "bench", image: bench },
  magic: { surface: "runes", material: "stone", image: river },
  nim: { surface: "river-game", material: "stone", image: river },
  compare: { surface: "river-game", material: "stone", image: river },
  clock: { surface: "clockmaker", material: "wood", image: wood },
  evenodd: { surface: "specimens", material: "bench", image: bench },
  groups: { surface: "parcel", material: "linen", image: linen },
  cipher: { surface: "runes", material: "stone", image: river },
  riddle: { surface: "runes", material: "stone", image: river },
  position: { surface: "finish-line", material: "bench", image: bench },
  colors: { surface: "paint", material: "bench", image: bench },
  shapepick: { surface: "toybox", material: "wood", image: wood },
  double: { surface: "mirror", material: "bench", image: bench },
  share: { surface: "picnic", material: "linen", image: linen },
  missing: { surface: "burrow", material: "wood", image: wood },
  days: { surface: "calendar", material: "linen", image: linen },
  legs: { surface: "farm", material: "wood", image: wood },
  change: { surface: "market", material: "bench", image: bench },
  fraction: { surface: "bakery", material: "linen", image: linen },
};

/** Fixed local surfaces stay available offline; storyline art remains independent. */
export function PuzzleWorld({ template, children }: { template: string; children: ReactNode }) {
  const world = WORLDS[template] ?? WORLDS.count;
  if (!world) return <div>{children}</div>;
  return <div className={`puzzle-world world-${world.surface} material-${world.material}`} data-template={template}>
    <img className="world-surface" src={world.image} alt="" width={1536} height={1024} loading="lazy" draggable={false} />
    <div className="world-content">{children}</div>
  </div>;
}

export function CarvedMark({ value, fresh }: { value: string; fresh: boolean }) {
  const numeric = /^\d+$/.test(value);
  return <span className={fresh ? "carved-mark carved-fresh" : "carved-mark"}>
    {numeric ? <svg viewBox="0 0 64 64" aria-hidden="true" className="carved-number"><text x="32" y="47" textAnchor="middle">{value}</text></svg> : <span className="carved-symbol">{value}</span>}
    {fresh && <span className="carving-dust" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
  </span>;
}