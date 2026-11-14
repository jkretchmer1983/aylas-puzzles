import type { ReactNode } from "react";
import tree from "@/assets/scene-tree.jpg";
import river from "@/assets/scene-river.jpg";
import workshop from "@/assets/scene-workshop.jpg";
import picnic from "@/assets/scene-picnic.jpg";
import market from "@/assets/scene-market.jpg";
import temple from "@/assets/scene-temple.jpg";

/** Each place is a real scene; its pieces are made of that place (bark chips, pebbles, price tags…). */
const STAGES = {
  tree: { material: "wood", image: tree },
  river: { material: "stone", image: river },
  workshop: { material: "bench", image: workshop },
  picnic: { material: "linen", image: picnic },
  market: { material: "wood", image: market },
  temple: { material: "stone", image: temple },
} as const;
type Stage = keyof typeof STAGES;

const WORLDS: Record<string, { surface: string; stage: Stage }> = {
  count: { surface: "basket", stage: "picnic" },
  pattern: { surface: "beads", stage: "tree" },
  odd: { surface: "specimens", stage: "workshop" },
  add: { surface: "harvest", stage: "picnic" },
  take: { surface: "bakery", stage: "picnic" },
  size: { surface: "rail", stage: "tree" },
  sequence: { surface: "stepping-stones", stage: "river" },
  sudoku: { surface: "tree-grid", stage: "tree" },
  lineup: { surface: "finish-line", stage: "workshop" },
  coins: { surface: "treasure", stage: "market" },
  sides: { surface: "workshop", stage: "workshop" },
  balance: { surface: "market", stage: "market" },
  magic: { surface: "runes", stage: "temple" },
  nim: { surface: "river-game", stage: "river" },
  compare: { surface: "river-game", stage: "river" },
  clock: { surface: "clockmaker", stage: "workshop" },
  evenodd: { surface: "specimens", stage: "river" },
  groups: { surface: "parcel", stage: "market" },
  cipher: { surface: "runes", stage: "temple" },
  riddle: { surface: "runes", stage: "temple" },
  position: { surface: "finish-line", stage: "tree" },
  colors: { surface: "paint", stage: "workshop" },
  shapepick: { surface: "toybox", stage: "temple" },
  double: { surface: "mirror", stage: "river" },
  share: { surface: "picnic", stage: "picnic" },
  missing: { surface: "burrow", stage: "tree" },
  days: { surface: "calendar", stage: "picnic" },
  legs: { surface: "farm", stage: "tree" },
  change: { surface: "market", stage: "market" },
  fraction: { surface: "bakery", stage: "market" },
};

export function worldFor(template: string) {
  const w = WORLDS[template] ?? WORLDS.count!;
  return { ...w, ...STAGES[w.stage] };
}

/** Full-screen scene behind the whole puzzle screen. */
export function WorldBackdrop({ template }: { template: string }) {
  const world = worldFor(template);
  return <div className={`world-backdrop material-${world.material} stage-${world.stage}`} aria-hidden="true"><img src={world.image} alt="" draggable={false} /></div>;
}

/** Fixed local surfaces stay available offline; storyline art remains independent. */
export function PuzzleWorld({ template, children }: { template: string; children: ReactNode }) {
  const world = worldFor(template);
  return <div className={`puzzle-world world-${world.surface} material-${world.material} stage-${world.stage}`} data-template={template}>
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
