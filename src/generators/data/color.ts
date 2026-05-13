import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const COLOR_NAMES = [
  "red", "blue", "green", "yellow", "orange", "purple",
  "pink", "black", "white", "gray", "brown", "cyan",
  "magenta", "lime", "indigo", "violet", "teal", "coral",
  "crimson", "gold", "silver", "navy", "olive", "maroon",
] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function colorName(prng: Prng): string {
  return prng.pick(COLOR_NAMES);
}

export function colorHex(prng: Prng): string {
  const [r, g, b] = prng.bytes(3);
  return "#" + [r!, g!, b!].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function colorRgb(prng: Prng): string {
  return `rgb(${prng.int(0, 255)}, ${prng.int(0, 255)}, ${prng.int(0, 255)})`;
}

export function colorHsl(prng: Prng): string {
  return `hsl(${prng.int(0, 359)}, ${prng.int(0, 100)}%, ${prng.int(0, 100)}%)`;
}
