import type { CSSProperties } from "react";

// Row-major positions in the generated embroidery atlas. The generator's symbols
// remain the keys: no theme substitution can alter a patch's identity.
export const LOOM_SYMBOLS = [
  "🍎",
  "🍌",
  "🍓",
  "🍇",
  "🍊",
  "🍐",
  "🍒",
  "🍉",
  "🐶",
  "🐱",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐸",
  "🐵",
  "🐯",
  "🦁",
  "🐷",
  "🐨",
  "🚗",
  "🚌",
  "🚲",
  "🚀",
  "🚂",
  "🚁",
  "⛵",
  "🚒",
  "☀️",
  "🌧️",
  "❄️",
  "🌈",
  "⛅",
  "🌪️",
  "⚽",
  "🏀",
  "🏈",
  "🎾",
  "⚾",
  "🏐",
];
export function Embroidery({ symbol }: { symbol: string }) {
  const i = LOOM_SYMBOLS.indexOf(symbol);
  return i < 0 ? (
    <span className="loom-symbol-fallback">{symbol}</span>
  ) : (
    <span
      className="loom-embroidery"
      role="img"
      aria-label={symbol}
      style={
        {
          "--symbol-x": `${((i % 8) * 100) / 7}%`,
          "--symbol-y": `${Math.floor(i / 8) * 25}%`,
        } as CSSProperties
      }
    />
  );
}
