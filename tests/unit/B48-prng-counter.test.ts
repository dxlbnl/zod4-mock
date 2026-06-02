/**
 * B48-R7 — per-call PRNG consumption from name + open-class-word leaf
 * generators becomes constant (one `prng.random()` draw per call).
 *
 * Spec: wiki/specs/B48-replace-markov-with-real-wordlists.md §R7.
 *
 * Mechanism: wrap a real `Prng` in a thin counter proxy that increments on
 * every `random()` call, hand the proxy to each leaf generator, reset the
 * counter before each call, and assert the counter equals 1 immediately
 * after each invocation. The post-B48 replacement code path dispatches to
 * a single `prng.pick(list)`, which is exactly one
 * `Math.floor(prng.random() * n)` per `src/prng.ts:91-93`.
 *
 * RED today: the leaves currently dispatch through `sampleMarkov` /
 * `sampleWeighted` (locale-nl ships Markov models for noun, adjective, and
 * weighted name-origin sets), which consume a variable number of `random()`
 * calls (1 + N character draws + up-to-8 rejection retries). Counter is
 * well above 1 on every call → every R7 `it(...)` fails today.
 *
 * GREEN after the implementer swaps the Markov branches to
 * `prng.pick(p.firstNamesMale)` etc. (per R3's `LocaleData` reshape) — the
 * counter then reads exactly 1 (and exactly 2 for the unspecified-gender
 * `firstName()` arm: one draw for the gender coin-flip, one for the pick).
 *
 * Per the spec's "Minimum tests directive": one test file, one R under
 * test (R7), one `it(...)` per leaf generator. R7 is the ONLY test-bearing
 * R in B48 — everything else is reviewer + typecheck + existing-suite.
 */

import { describe, it, expect } from "vitest";
import { createPrng } from "../../src/prng.js";
import type { Prng, GeneratorContext } from "../../src/types.js";
import { nl } from "@zod4-mock/locale-nl";
import { noun, adjective } from "../../src/generators/data/word.js";
import { firstName, lastName } from "../../src/generators/data/person.js";

// ---------------------------------------------------------------------------
// Counter proxy — wraps a real `Prng` and ticks `count` on every `random()`
// call. Every other `Prng` method is forwarded; `pick` is re-implemented via
// the counting `random()` so a single pick consumes exactly one tick on the
// counter (matches `src/prng.ts:91-93`).
//
// No `any` — every method is typed against the `Prng` interface from
// `@zod4-mock/locale-core` (re-exported via `src/types.js`).
// ---------------------------------------------------------------------------

function makeCountingPrng(inner: Prng): { prng: Prng; count: () => number; reset: () => void } {
  let counter = 0;
  const prng: Prng = {
    get seed(): number {
      return inner.seed;
    },
    random(): number {
      counter += 1;
      return inner.random();
    },
    int(min: number, max: number): number {
      return inner.int(min, max);
    },
    pick<T>(items: readonly T[]): T | undefined {
      return items[Math.floor(prng.random() * items.length)];
    },
    pickZipf<T>(items: readonly T[], s: number): T {
      // Re-implement against `prng.random()` (the wrapper) so the counter
      // observes the single draw — the inner implementation routes through
      // its own closure-captured `prng.random()` (= `inner.random()`), which
      // bypasses the wrapper. Closed-form formula mirrors `src/prng.ts`'s
      // `pickZipf` (B55-R1).
      const N = items.length;
      const u = prng.random();
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
      return items[Math.max(0, Math.min(raw, N - 1))]!;
    },
    shuffle<T>(items: readonly T[]): T[] {
      return inner.shuffle(items);
    },
    sample<T>(items: readonly T[], count: number): T[] {
      return inner.sample(items, count);
    },
    fork(key: string): Prng {
      return inner.fork(key);
    },
    bytes(n: number): Uint8Array {
      return inner.bytes(n);
    },
  };
  return {
    prng,
    count: () => counter,
    reset: () => {
      counter = 0;
    },
  };
}

// Narrow ctx helpers — leaf generators only read `ctx.locale` (and, for the
// gender-aware `firstName` arm, `ctx.current`). Everything else on
// `GeneratorContext` is irrelevant for R7. Same idiom as
// `tests/unit/generators/domains/localization.test.ts:7`.
//
// IMPORTANT: `firstName(prng, "male")` (gender STRING form) hits the
// `defaultLocale` branch — there's no slot for `locale` in that overload —
// and defaultLocale ships only `simple*` arrays, so the count is already
// 1 today (a trivially-passing test). R7's invariant is that the count is
// 1 *for the locale the spec puts under test* (`nl`), which means the
// Markov-populated locale must reach the leaf. The signature carries
// gender via `ctx.current.gender` (see `extractGender` → `siblingString`
// in `src/generators/data/person.ts:33-40,33-48`), so we pass a ctx with
// both `locale: nl` AND `current: { gender: ... }`. This is the same
// path `key-based.ts` uses when a registered schema has a sibling
// `gender` field — i.e. the path the spec's R7 scenario describes.

const nlCtx = { locale: nl, current: {} } as unknown as GeneratorContext;
const nlCtxMale = { locale: nl, current: { gender: "male" } } as unknown as GeneratorContext;
const nlCtxFemale = { locale: nl, current: { gender: "female" } } as unknown as GeneratorContext;

describe("B48-R7: leaf generators consume exactly 1 prng.random() draw per call", () => {
  it("B48-R7 / noun() consumes exactly 1 prng.random() draw", () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    noun(prng, nlCtx);
    expect(count()).toBe(1);
  });

  it("B48-R7 / adjective() consumes exactly 1 prng.random() draw", () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    adjective(prng, nlCtx);
    expect(count()).toBe(1);
  });

  it('B48-R7 / firstName(prng, ctx{ locale: nl, gender: "male" }) consumes exactly 1 prng.random() draw', () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    firstName(prng, nlCtxMale);
    expect(count()).toBe(1);
  });

  it('B48-R7 / firstName(prng, ctx{ locale: nl, gender: "female" }) consumes exactly 1 prng.random() draw', () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    firstName(prng, nlCtxFemale);
    expect(count()).toBe(1);
  });

  it("B48-R7 / lastName() consumes exactly 1 prng.random() draw", () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    lastName(prng, nlCtx);
    expect(count()).toBe(1);
  });

  // Documenting case — the unspecified-gender ctx path. `firstName` extracts
  // gender via `siblingString(ctx.current, "gender", ...)`; an empty
  // `current` returns "neutral", and the function takes the
  // `prng.random() < 0.5` coin-flip arm at `src/generators/data/person.ts:80`
  // before the underlying `pick`. Post-B48 that's exactly 2 draws (coin-flip
  // + pick). Pinned so a future refactor that collapses the coin-flip
  // surfaces immediately.
  it("B48-R7 / firstName() with unspecified gender consumes exactly 2 prng.random() draws", () => {
    const { prng, count, reset } = makeCountingPrng(createPrng(42));
    reset();
    firstName(prng, nlCtx);
    expect(count()).toBe(2);
  });
});
