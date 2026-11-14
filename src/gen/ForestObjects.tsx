import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Layered, inset SVG lighting stays separate from generator-owned values. */
export function EngravedNumber({ value }: { value: string }) {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="0 0 80 90" className="forest-numeral" aria-hidden="true">
    <defs>
      <filter id={`cut-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="8" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale=".7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <mask id={`groove-${id}`}><text x="40" y="72" textAnchor="middle" className="engraving-mask">{value}</text></mask>
    </defs>
    <text x="40" y="74" textAnchor="middle" className="engraving-lip">{value}</text>
    <g mask={`url(#groove-${id})`} filter={`url(#cut-${id})`}>
      <rect width="80" height="90" className="engraving-depth" />
      <text x="41.5" y="74" textAnchor="middle" className="engraving-floor">{value}</text>
    </g>
  </svg>;
}

export function WoodenTitleSign({ title, story, spatial }: { title: string; story: string; spatial: boolean }) {
  return <div className="wooden-title-sign"><h1>{title}</h1>{!spatial && <p>{story}</p>}</div>;
}

export function WoodenActionButton({ children, onClick, disabled, primary, className = "", label }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; className?: string; label?: string }) {
  return <Button variant="game" size="game" disabled={disabled} onClick={onClick} aria-label={label} title={label} className={`wooden-action ${primary ? "wooden-action-primary" : ""} ${className}`}>{children}</Button>;
}