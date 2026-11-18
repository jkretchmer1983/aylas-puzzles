import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PUBLIC_BANDS, bandById } from "@/lib/public-catalog";

/**
 * Portrait age chooser: a tactile field that opens a listbox of the six public age bands.
 * Button + listbox pattern (aria-haspopup / aria-activedescendant) with full keyboard support.
 */
export function AgeDropdown({ idPrefix, band, onChoose, labelId, label, closed }: {
  idPrefix: string;
  band: number;
  onChoose: (band: number) => void;
  /** Id of an existing visible label (e.g. the dock heading); otherwise `label` is rendered. */
  labelId?: string;
  label?: string;
  /** Force-close (e.g. when the compact bar hides). */
  closed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(band);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = bandById(band);
  const ownLabelId = `${idPrefix}-label`;
  const labelledBy = labelId ?? ownLabelId;
  const listId = `${idPrefix}-list`;
  const optionId = (id: number) => `${idPrefix}-opt-${id}`;

  useEffect(() => { if (closed) setOpen(false); }, [closed]);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openList = (start = band) => {
    setActive(start);
    setOpen(true);
    requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  };
  const choose = (id: number) => { onChoose(id); close(true); };
  const indexOf = (id: number) => PUBLIC_BANDS.findIndex((item) => item.id === id);
  const step = (from: number, delta: number) => PUBLIC_BANDS[Math.min(PUBLIC_BANDS.length - 1, Math.max(0, indexOf(from) + delta))]!.id;

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList(event.key === "ArrowDown" ? band : step(band, -1));
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    let next = active;
    switch (event.key) {
      case "ArrowDown": next = step(active, 1); break;
      case "ArrowUp": next = step(active, -1); break;
      case "Home": next = PUBLIC_BANDS[0]!.id; break;
      case "End": next = PUBLIC_BANDS[PUBLIC_BANDS.length - 1]!.id; break;
      case "Enter": case " ": event.preventDefault(); choose(active); return;
      case "Escape": event.preventDefault(); close(true); return;
      case "Tab": setOpen(false); return;
      default: return;
    }
    event.preventDefault();
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };

  return <div ref={rootRef} className={`commons-age-select${open ? " is-open" : ""}`}>
    {!labelId && <span id={ownLabelId} className="commons-age-select-label">{label ?? "Choose your age"}</span>}
    <button
      ref={buttonRef}
      id={`${idPrefix}-button`}
      type="button"
      className="commons-age-select-field"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-labelledby={`${labelledBy} ${idPrefix}-button`}
      onClick={() => (open ? close(false) : openList())}
      onKeyDown={onButtonKey}
    >
      <span className="commons-age-select-value">{selected.label}</span>
      <span className="commons-age-select-chevron" aria-hidden="true"><ChevronDown /></span>
    </button>
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-activedescendant={open ? optionId(active) : undefined}
      className="commons-age-select-list"
      hidden={!open}
      onKeyDown={onListKey}
      onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    >
      {PUBLIC_BANDS.map((item) => <li
        key={item.id}
        id={optionId(item.id)}
        role="option"
        aria-selected={band === item.id}
        className={`commons-age-option${active === item.id ? " is-active" : ""}`}
        onPointerMove={() => setActive(item.id)}
        onClick={() => choose(item.id)}
      >{band === item.id ? <Check aria-hidden="true" /> : <span className="commons-age-option-dot" aria-hidden="true" />}{item.label}</li>)}
    </ul>
  </div>;
}
