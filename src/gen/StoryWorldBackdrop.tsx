import picturebook from "@/assets/story-worlds/picturebook.jpg";
import adventure from "@/assets/story-worlds/adventure.jpg";
import expedition from "@/assets/story-worlds/expedition.jpg";
import { PuzzleDrawing } from "./PuzzleDrawing";
import type { WorldEntry } from "@/lib/story-world-cache";
import { storyWorldTier } from "@/lib/story-world";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function StoryWorldBackdrop({ band, template, seed, entry, revealed }: { band: number; template?: string | undefined; seed?: number | undefined; entry?: WorldEntry | undefined; revealed: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [painted, setPainted] = useState(false);
  useEffect(() => { if (loaded && revealed) setPainted(true); }, [loaded, revealed]);
  const fallback = { picturebook, adventure, expedition }[storyWorldTier(band)];
  return <div className="sw-backdrop" aria-hidden="true">
    <img className="sw-landscape" src={fallback} width={1536} height={1024} alt="" draggable={false} />
    {template && <div className="sw-fallback-motif"><PuzzleDrawing template={template} seed={seed ?? 1} ornament /></div>}
    {entry?.src && <div className={cn("sw-paint-layer", painted && "sw-painted")}>
      <img className={cn("sw-landscape", !entry.final && "sw-partial")} src={entry.src} onLoad={() => setLoaded(true)} alt="" draggable={false} />
    </div>}
  </div>;
}

export function WorldCelebration({ burst }: { burst: number }) {
  return burst > 0 ? <div className="sw-confetti" key={burst} aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * .07}s`, ["--turn" as string]: `${i * 53}deg` }} />)}</div> : null;
}