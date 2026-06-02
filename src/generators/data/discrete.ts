/**
 * @module discrete
 * B57-R6: `quantity` / `count` truncated-geometric distributions.
 *
 * Closed-form: `offset = floor(log(1 - u) / log(1 - p)); v = min + min(offset, max - min)`,
 * with `p = 0.5`. The `min = 0` case (e.g. `count`) is handled natively
 * (offset 0 → value 0); no special-case branch.
 *
 * Pure-`Math.*` only — D13 isomorphic.
 *
 * See B54 research report §3 / B57 spec R6.
 */

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
