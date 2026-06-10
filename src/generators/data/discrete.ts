import type { Prng } from "../../types.js";

const P = 0.5;

export function quantity(prng: Prng, min = 1, max = 100): number {
  const offset = prng.geometric(P);
  return min + Math.min(offset, max - min);
}

export function count(prng: Prng, min = 0, max = 50): number {
  const offset = prng.geometric(P);
  return min + Math.min(offset, max - min);
}
