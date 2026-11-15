import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Layered, inset SVG lighting stays separate from generator-owned values. */
export function EngravedNumber({ value, fresh = false }: { value: string; fresh?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="0 0 80 90" className={`forest-numeral${fresh ? " engraving-in-progress" : ""}`} aria-hidden="true">
    <defs>
      <filter id={`cut-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="8" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale=".7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <mask id={`carve-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="80" height="90"><path className="engraving-cut-path" d="M0 8H80L0 24H80L0 40H80L0 56H80L0 72H80L0 88H80" pathLength="1" fill="none" stroke="white" strokeWidth="22" strokeLinejoin="round" /></mask>
      <mask id={`groove-${id}`}><text x="40" y="72" textAnchor="middle" className="engraving-mask">{value}</text></mask>
    </defs>
    <g mask={fresh ? `url(#carve-${id})` : undefined}>
    <text x="40" y="74" textAnchor="middle" className="engraving-lip">{value}</text>
    <g mask={`url(#groove-${id})`} filter={`url(#cut-${id})`}>
      <rect width="80" height="90" className="engraving-depth" />
      <text x="41.5" y="74" textAnchor="middle" className="engraving-floor">{value}</text>
    </g>
    </g>
  </svg>;
}

export function WoodenTitleSign({ title, story, spatial }: { title: string; story: string; spatial: boolean }) {
  return <div className="wooden-title-sign"><h1>{title}</h1>{!spatial && <p>{story}</p>}</div>;
}

export function WoodenActionButton({ children, onClick, disabled, primary, className = "", label }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; className?: string; label?: string }) {
  return <Button variant="game" size="game" disabled={disabled} onClick={onClick} aria-label={label} title={label} className={`wooden-action ${primary ? "wooden-action-primary" : ""} ${className}`}>{children}</Button>;
}