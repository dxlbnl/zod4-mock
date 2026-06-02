/**
 * B66 regression — `sentence()` Template 3 must emit an object-form pronoun
 * ("him", "her", "it", "them", "us", "me") in the object slot, not a subject
 * pronoun ("they", "we", "I"). Covers both the library fallback path against
 * `defaultLocale` and locale-en's `formatSentence`.
 *
 * Strategy: drive many seeds; for every emitted sentence, look for the
 * pattern `<verb> <pronoun>` (a pronoun directly following a word) and assert
 * the pronoun is NOT one of the subject-only forms. We can't easily isolate
 * Template 3 specifically, but the negative invariant holds across all
 * templates — only Template 3 uses a pronoun in object position; if a
 * subject pronoun ever follows a verb token, the regression has reoccurred.
 */
import { describe, expect, it } from "vitest";
import { createPrng } from "../../src/prng.js";
import { sentence } from "../../src/generators/data/word.js";
import { en } from "@zod4-mock/locale-en";
import type { LocaleData } from "@zod4-mock/locale-core";

const SUBJECT_ONLY = /\b(?:they|we|i)\b/i;
const N_SAMPLES = 200;

function sweep(locale: LocaleData | undefined): {
  offenders: string[];
} {
  const offenders: string[] = [];
  for (let seed = 0; seed < N_SAMPLES; seed++) {
    const prng = createPrng(seed);
    // Cast: `sentence()` only reads `ctx?.locale` from the context, so a
    // partial { locale } shape is sufficient for this regression test.
    const out = sentence(
      prng,
      locale ? ({ locale } as unknown as Parameters<typeof sentence>[1]) : undefined,
    );
    // Drop sentence-initial capitalised pronoun (Template 2's subject slot).
    // Anything that survives is mid-sentence position; if it matches a
    // subject-only pronoun, that's Template 3 emitting a subject in the
    // object slot — the B66 regression.
    const midSentence = out.replace(/^[A-Z]\w*\s/, " ").replace(/\.$/, "");
    if (SUBJECT_ONLY.test(midSentence)) {
      offenders.push(out);
    }
  }
  return { offenders };
}

describe("B66: sentence() Template 3 emits object-form pronoun, not subject form", () => {
  it("library fallback path (defaultLocale) never emits a subject pronoun mid-sentence", () => {
    const { offenders } = sweep(undefined);
    expect(offenders, `${offenders.length} offending sentences, e.g.: ${offenders[0]}`).toEqual([]);
  });

  it("locale-en formatSentence never emits a subject pronoun mid-sentence", () => {
    const { offenders } = sweep(en);
    expect(offenders, `${offenders.length} offending sentences, e.g.: ${offenders[0]}`).toEqual([]);
  });
});
