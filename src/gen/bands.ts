import type { Band } from "./types";

/** Age bands 0–6 (Ages 3–4 … 9–10). Kept free of generator imports so the thin hub can use them. */
export const BANDS: Band[] = [3, 4, 5, 6, 7, 8, 9].map((min, id) => ({ id, min, max: min + 1, label: `Ages ${min}–${min + 1}` }));
