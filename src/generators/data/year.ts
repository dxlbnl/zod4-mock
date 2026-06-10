import type { Prng } from "../../types.js";

const LAMBDA = 0.05;

export function year(prng: Prng, min?: number, max?: number): number {
  const currentYear = new Date().getFullYear();
  const lo = min ?? currentYear - 50;
  const hi = max ?? currentYear;

  if (hi - lo < 10) {
    return prng.int(Math.ceil(lo), Math.floor(hi));
  }

  const u = prng.random();
  const offset = Math.floor(-Math.log(1 - u) / LAMBDA);
  return Math.max(lo, hi - offset);
}
