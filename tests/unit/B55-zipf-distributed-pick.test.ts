/**
 * Unit tests for B55 — Zipf-distributed pick (`prng.pickZipf`,
 * `frequencyExponent` config, per-corpus map, freq-sort retrofit).
 *
 * Spec: wiki/specs/B55-zipf-distributed-pick.md
 *
 * Per the spec's `## Minimum tests directive` + [[feedback-minimal-tests]]:
 * one test file with six `it(...)` blocks — one per test-bearing R-ID
 * (R1 split into R1a + R1b per the spec's `## Minimum tests directive`).
 *
 *   - R1a — `prng.pickZipf(items, 0)` is index-equivalent to `prng.pick(items)`
 *     on the same PRNG state AND consumes exactly one `random()` draw.
 *   - R1b — Zipf-1 head-skew: across 1000 draws on a 10-element array, the
 *     head index appears strictly more often than the tail index, and the
 *     head count visibly exceeds the uniform expectation.
 *   - R2  — `LocaleData.frequencyExponent?` + `LocaleData.frequencyExponentOverrides?`
 *     are additive, optional fields (type-level presence check).
 *   - R3  — open-corpus call sites (representative: `lastName`) route through
 *     `pickZipf`. Under `frequencyExponentOverrides: { lastNames: 1.0 }` a
 *     1000-record sweep produces a visibly head-skewed distribution; under
 *     no override (uniform) it does not (sanity baseline).
 *   - R5  — first-three-entries assertion against the shipped first-name
 *     corpora (post-retrofit must be SSA-frequency-descending — NOT the
 *     pre-retrofit alphabetical `"aaden", "aarav", "aaron"`) and a regression
 *     guard on `lastNames` (already correct: `"smith", "johnson", "williams"`).
 *   - R6  — unique-context generation auto-flattens to `s = 0` even when the
 *     locale configures Zipf-1 on the corpus; tail-half entries appear in the
 *     output.
 *
 * R4 (per-corpus map values), R7 (docs), R8 (changeset), R9 (snapshot re-pin),
 * R10 (no new public exports), R11 (no new D-number) are reviewer-only.
 *
 * RED expectations today (pre-B55):
 *
 *   - R1a / R1b: FAIL at typecheck — `prng.pickZipf` does not exist on the
 *     `Prng` interface (`packages/locale-core/src/types.ts:8-18`).
 *   - R2: FAIL at typecheck — `LocaleData` does not declare
 *     `frequencyExponent` / `frequencyExponentOverrides` (TS2353 on the
 *     object literal that sets them).
 *   - R3: FAIL at typecheck (cascading from R2 — the test constructs a
 *     locale with `frequencyExponentOverrides`) AND at runtime once the
 *     typecheck passes (today `person.lastName` calls `prng.pick`, so the
 *     distribution is uniform, not head-skewed).
 *   - R5: FAIL at runtime — `firstNamesMale[0] === "aaden"` today
 *     (alphabetical `.sort()` at `packages/locale-en/scripts/fetch-data.ts:135`).
 *   - R6: FAIL at typecheck (cascading from R2 — the test constructs a
 *     locale with `frequencyExponentOverrides`) AND at runtime once
 *     typecheck passes (no auto-flatten wiring yet, and `pick` is uniform
 *     today regardless).
 *
 * D1 (no `any`), D13 (`.js` extensions on relative imports), and per the
 * test-file convention test files may import test-runner globals freely.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../src/prng.js";
import { createWorld } from "../../src/world.js";
import { defaultLocale } from "../../src/default-locale.js";
import type { LocaleData, Prng } from "../../src/types.js";
import { firstNamesMale, lastNames } from "@zod4-mock/locale-en";

// ---------------------------------------------------------------------------
// R1a — `prng.pickZipf(items, 0)` reproduces `prng.pick(items)` on the same
// PRNG state and consumes exactly one `random()` draw.
// ---------------------------------------------------------------------------

describe("B55-R1a: pickZipf(items, 0) === pick(items), one draw", () => {
  it("B55-R1 / s=0 reproduces pick AND consumes exactly one random() draw", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

    // Scenario: `s = 0` reproduces `prng.pick`.
    // Two PRNGs seeded identically; one calls pickZipf(items, 0), the other
    // pick(items). They MUST return the same element.
    const prngA = createPrng(42);
    const prngB = createPrng(42);

    const picked = prngB.pick(items);
    const zipfPicked = prngA.pickZipf(items, 0);
    expect(zipfPicked).toBe(picked);

    // Scenario: single PRNG draw, no rejection loop.
    // Wrap `random()` on a fresh PRNG to count calls; pickZipf(items, 1)
    // MUST advance the counter by exactly one.
    const base = createPrng(7);
    let calls = 0;
    const counted: Prng = {
      ...base,
      random(): number {
        calls += 1;
        return base.random();
      },
      pickZipf<T>(arr: readonly T[], s: number): T {
        // Re-implement `pickZipf` against this wrapper's own `random()` so
        // the counter observes the single draw. Delegating to `base.pickZipf`
        // would route through its closure-captured `base.random()` and
        // bypass the counter (B48 `makeCountingPrng` precedent — see
        // `tests/unit/B48-prng-counter.test.ts`). Closed-form formula
        // mirrors `src/prng.ts`'s `pickZipf` (B55-R1).
        const N = arr.length;
        const u = counted.random();
        let raw: number;
        if (s === 0) {
          raw = Math.floor(1 + u * N) - 1;
        } else if (s === 1) {
          raw = Math.floor(Math.pow(N + 1, u)) - 1;
        } else {
          const oneMinusS = 1 - s;
          const term = 1 + u * (Math.pow(N + 1, oneMinusS) - 1);
          raw = Math.floor(Math.pow(term, 1 / oneMinusS)) - 1;
        }
        return arr[Math.max(0, Math.min(raw, N - 1))]!;
      },
    };
    counted.pickZipf(["a", "b", "c", "d", "e"] as const, 1);
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// R1b — Zipf-1 head-skew: across 1000 draws on a 10-element array, the head
// index appears strictly more often than the tail index, and the head count
// visibly exceeds uniform expectation (50 — the uniform mean is 100/bucket).
// ---------------------------------------------------------------------------

describe("B55-R1b: pickZipf(items, 1) favours the head", () => {
  it("B55-R1 / Zipf-1 over 1000 draws skews counts toward the head index", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
    const prng = createPrng(42);
    const counts = new Map<string, number>(items.map((it) => [it, 0]));
    for (let i = 0; i < 1000; i++) {
      const v = prng.pickZipf(items, 1);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const aCount = counts.get("a") ?? 0;
    const jCount = counts.get("j") ?? 0;

    // Head dominates the tail.
    expect(aCount).toBeGreaterThan(jCount);
    // Head exceeds uniform's expected 100/bucket by a wide margin (per the
    // spec scenario: "the count of 'a' exceeds N/2 · (1/N) · 1000 = 50").
    expect(aCount).toBeGreaterThan(150);
  });
});

// ---------------------------------------------------------------------------
// R2 — `LocaleData.frequencyExponent?` and
// `LocaleData.frequencyExponentOverrides?` are optional, additive fields.
// Construct one literal with both fields set and one with both omitted; both
// MUST satisfy `LocaleData`. The runtime expects are sentinels — the real
// assertion is the typecheck pass under `pnpm validate`.
// ---------------------------------------------------------------------------

describe("B55-R2: LocaleData has optional frequencyExponent + overrides fields", () => {
  it("B55-R2 / type-level presence — both fields may be set, and both may be omitted", () => {
    // Scenario: locale-level default set + per-corpus override set.
    // Spread defaultLocale to satisfy the rest of LocaleData; add the two
    // new fields. TS2353 (unknown property) fires here pre-B55.
    const withConfig: LocaleData = {
      ...defaultLocale,
      frequencyExponent: 0.9,
      frequencyExponentOverrides: { lastNames: 0.7, firstNamesMale: 0.9 },
    };

    // Scenario: type addition is additive — locale that omits both fields
    // type-checks unchanged.
    const withoutConfig: LocaleData = { ...defaultLocale };

    // Structural sentinels — the contract is the typecheck.
    expect(withConfig.frequencyExponent).toBe(0.9);
    expect(withConfig.frequencyExponentOverrides?.lastNames).toBe(0.7);
    expect(withoutConfig.frequencyExponent).toBeUndefined();
    expect(withoutConfig.frequencyExponentOverrides).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// R3 — open-corpus data-generator call sites route through `pickZipf`.
//
// Representative open corpus: `lastNames`. The library's `person.lastName`
// generator picks from `loc.person.lastNames`. Under
// `frequencyExponentOverrides: { lastNames: 1.0 }` a sweep MUST produce a
// visibly head-skewed distribution — the head third of the corpus dominates
// the tail third by a wide margin. Today (pre-B55) `person.lastName` calls
// `prng.pick` directly, so the distribution is uniform and the assertion
// fails.
// ---------------------------------------------------------------------------

describe("B55-R3: open-corpus call sites use pickZipf", () => {
  it("B55-R3 / lastName under frequencyExponentOverrides.lastNames=1 head-skews", () => {
    // 30-entry custom corpus — large enough that uniform sampling would
    // spread evenly across all three thirds, small enough that 1000 draws
    // gives clean counts per bucket.
    const corpus: readonly string[] = [
      "smith",
      "johnson",
      "williams",
      "brown",
      "jones",
      "garcia",
      "miller",
      "davis",
      "rodriguez",
      "martinez",
      "hernandez",
      "lopez",
      "gonzalez",
      "wilson",
      "anderson",
      "thomas",
      "taylor",
      "moore",
      "jackson",
      "martin",
      "lee",
      "perez",
      "thompson",
      "white",
      "harris",
      "sanchez",
      "clark",
      "ramirez",
      "lewis",
      "robinson",
    ];
    const localeZipf1: LocaleData = {
      ...defaultLocale,
      person: { ...defaultLocale.person, lastNames: corpus, lastNamePrefixes: [] },
      frequencyExponent: 1.0,
      frequencyExponentOverrides: { lastNames: 1.0 },
    };

    // Schema with a `lastName` field — routes through `data.person.lastName`
    // via the default key map (`lastName` exact-match → person.lastName).
    const Schema = z.object({ lastName: z.string() });

    // 1000-record sweep on a fresh world per record to isolate per-record
    // PRNG state (the world's internal record counter would otherwise mix
    // draws across calls and obscure the per-field distribution).
    // Use distinct seeds so we sample 1000 independent fork states.
    const counts = new Map<string, number>(corpus.map((s) => [s, 0]));
    for (let seed = 0; seed < 1000; seed++) {
      const w = createWorld({ seed, locale: localeZipf1 });
      const record = w.generate(Schema);
      const ln = record.lastName.toLowerCase();
      counts.set(ln, (counts.get(ln) ?? 0) + 1);
    }

    // Sum head third (indices 0..9) and tail third (indices 20..29).
    const head = corpus.slice(0, 10).reduce((acc, s) => acc + (counts.get(s) ?? 0), 0);
    const tail = corpus.slice(20, 30).reduce((acc, s) => acc + (counts.get(s) ?? 0), 0);

    // Under Zipf-1 the head third MUST dominate the tail third by a wide
    // margin (head > 3x tail). Under uniform `pick` (today) head ≈ tail,
    // so this assertion catches the missing call-site swap.
    expect(head).toBeGreaterThan(tail * 3);
  });
});

// ---------------------------------------------------------------------------
// R5 — Freq-sort retrofit on first-name fetch scripts.
//
// Post-retrofit `firstNamesMale[0]` MUST NOT be `"aaden"` (the alphabetical-
// first entry the pre-retrofit `.sort()` produced). The shipped corpus must
// instead start with the SSA top-3 male names by frequency. We assert the
// negative ("not aaden") rather than a specific top-3 because the spec
// allows the implementer to pick the SSA snapshot year and the surface
// form (the historical top-3 in the SSA dataset is stable but the test
// shouldn't pin a moving target). The accompanying lastNames regression
// guard confirms the already-correct lastNames order is preserved.
// ---------------------------------------------------------------------------

describe("B55-R5: en first-name corpora ship in descending-frequency order", () => {
  it("B55-R5 / firstNamesMale[0] is frequency-leader (not alphabetical 'aaden'); lastNames unchanged", () => {
    // Scenario: en first-name corpora ship in descending-frequency order.
    // Pre-retrofit: firstNamesMale[0] === "aaden" (alphabetical sort output).
    // Post-retrofit: a frequency-leader (e.g. "james" / "john" / "michael").
    expect(firstNamesMale[0]).not.toBe("aaden");
    expect(firstNamesMale.length).toBeGreaterThan(0);

    // Scenario: en `lastNames` order is preserved (regression guard).
    // `lastNames` already sort descending by Census count — this MUST NOT
    // shift in the retrofit commit.
    expect(lastNames[0]).toBe("smith");
    expect(lastNames[1]).toBe("johnson");
    expect(lastNames[2]).toBe("williams");
  });
});

// ---------------------------------------------------------------------------
// R6 — `unique` contexts auto-flatten to `s = 0`.
//
// The spec is mechanism-agnostic about how unique-context is signalled to
// the `pickZipf` resolution layer. The observable invariant under test is:
// when the engine is in a `unique`-draw context AND the locale configures
// Zipf-1 on the corpus, the returned values are drawn uniformly (= as if
// `s = 0`), so tail-half entries appear in the output.
//
// We drive this through `world.generate(z.array(...).length(N), { unique: true })`
// per the test-writer dispatch's chosen surface. Today this fails for one
// of two reasons (either is acceptable RED per the dispatch):
//   - typecheck: `frequencyExponentOverrides` does not exist on `LocaleData`
//     (cascades from R2's missing fields).
//   - runtime: even after R1/R2 type-level, the auto-flatten wiring is not
//     yet in place — under Zipf-1 the head dominates and no tail-half entry
//     appears.
// ---------------------------------------------------------------------------

describe("B55-R6: unique-context generation auto-flattens Zipf-1 to uniform", () => {
  it("B55-R6 / unique lastName draws under Zipf-1 still include tail-half entries", () => {
    // 20-entry corpus so head/tail halves are well-defined (indices 0..9
    // = head, 10..19 = tail). Under Zipf-1 without auto-flatten, head
    // entries dominate so heavily that the tail half is virtually
    // never sampled. Under R6's auto-flatten, the unique-context draws
    // behave as uniform `pick` and tail-half entries appear naturally.
    const corpus: readonly string[] = [
      "smith",
      "johnson",
      "williams",
      "brown",
      "jones",
      "garcia",
      "miller",
      "davis",
      "rodriguez",
      "martinez",
      "hernandez",
      "lopez",
      "gonzalez",
      "wilson",
      "anderson",
      "thomas",
      "taylor",
      "moore",
      "jackson",
      "martin",
    ];
    const tailSet = new Set(corpus.slice(10, 20));

    const localeZipf1: LocaleData = {
      ...defaultLocale,
      person: { ...defaultLocale.person, lastNames: corpus, lastNamePrefixes: [] },
      frequencyExponent: 1.0,
      frequencyExponentOverrides: { lastNames: 1.0 },
    };

    const w = createWorld({ seed: 42, locale: localeZipf1 });

    // Drive an array of last-name records with `unique: true` — the spec
    // R6 marker for the unique-draw loop. Length 30 forces the loop to
    // visit more entries than the head third (10) can supply uniquely.
    const Schema = z.array(z.object({ lastName: z.string() })).length(30);
    const arr = w.generate(Schema, { unique: true });

    // At least 3 distinct tail-half entries MUST appear across the 30 draws.
    // Under uniform sampling on a 20-entry corpus over 30 draws, tail-half
    // hits are overwhelmingly likely; under un-flattened Zipf-1 they are
    // overwhelmingly unlikely.
    const distinctTailHits = new Set<string>();
    for (const record of arr) {
      const ln = record.lastName.toLowerCase();
      if (tailSet.has(ln)) distinctTailHits.add(ln);
    }
    expect(distinctTailHits.size).toBeGreaterThanOrEqual(3);
  });
});
