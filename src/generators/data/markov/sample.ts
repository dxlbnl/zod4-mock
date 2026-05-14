import type { Prng } from "../../../types.js";
import type { MarkovModel, NameOriginSet } from "@zod4-mock/locale-core";

// Four or more consecutive consonants never appear in real names across any
// of the supported locales — used to reject Markov dead-end cascades.
const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{4}/i;

function sampleOnce(prng: Prng, model: MarkovModel, minLen: number, maxLen: number): string {
  const softMax = Math.max(minLen, Math.floor(maxLen * 0.6));
  let state = "";
  let word = "";

  for (;;) {
    if (word.length >= softMax && word.length >= minLen) {
      const stopProb = (word.length - softMax) / (maxLen - softMax);
      if (prng.random() < stopProb) break;
    }

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
      state = "";
      word = "";
    } else {
      word += char;
      state += char;
      if (word.length >= maxLen) break;
    }
  }

  return word;
}

/**
 * Sample one word from a Markov model using CDF binary search.
 *
 * The "$" character in model.chars is the end-of-word sentinel.
 * If the word is shorter than minLen when "$" is drawn, sampling continues.
 * Words containing 4+ consecutive consonants (Markov dead-end artifacts) are
 * rejected and resampled, up to 8 attempts.
 */
export function sampleMarkov(
  prng: Prng,
  model: MarkovModel,
  minLen = 3,
  maxLen = 12,
): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const word = sampleOnce(prng, model, minLen, maxLen);
    if (word.length >= minLen && !CONSONANT_RUN.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }
  // All attempts produced garbage — return the sentinel fallback
  return "x";
}

/**
 * Pick a cultural-origin model by weighted random selection, then sample one word from it.
 */
export function sampleWeighted(prng: Prng, sets: readonly NameOriginSet[]): string {
  const total = sets.reduce((s, m) => s + m.weight, 0);
  const target = prng.random() * total;
  let cumulative = 0;
  for (const { model, weight } of sets) {
    cumulative += weight;
    if (target < cumulative) return sampleMarkov(prng, model);
  }
  // Fallback — floating-point rounding
  return sampleMarkov(prng, sets[sets.length - 1]!.model);
}
