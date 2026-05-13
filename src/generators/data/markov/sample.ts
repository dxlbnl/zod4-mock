import type { Prng } from "../../../types.js";
import type { MarkovModel } from "../../../locales/types.js";

/**
 * Sample one word from a Markov model using CDF binary search.
 *
 * The "$" character in model.chars is the end-of-word sentinel.
 * If the word is shorter than minLen when "$" is drawn, sampling continues.
 */
export function sampleMarkov(
  prng: Prng,
  model: MarkovModel,
  minLen = 3,
  maxLen = 12,
): string {
  let state = "";
  let word = "";

  for (;;) {
    const key = state.slice(-model.order);
    const weights = model.table[key] ?? model.table[""];
    if (!weights) break;

    const r = prng.random();
    let lo = 0;
    let hi = weights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((weights[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }

    const char = model.chars[lo];
    if (!char) break;

    if (char === "$") {
      if (word.length >= minLen) break;
      // Too short — reset and try again from empty state
      state = "";
      word = "";
    } else {
      word += char;
      state += char;
      if (word.length >= maxLen) break;
    }
  }

  // If we ended up empty (e.g. bad model), return a fallback
  if (word.length === 0) return "x";

  return word.charAt(0).toUpperCase() + word.slice(1);
}
