/**
 * Unit tests for B40 — `ctx.gen.<ns>.<fn>()` ignores the configured locale.
 *
 * Spec: wiki/specs/B40-ctx-gen-ignores-locale.md
 *
 * Today `WorldImpl.bindGenerators` wraps each locale-aware helper in a Proxy
 * that binds **only** the field PRNG. The bound function calls the helper as
 * `fn(prng, ...args)`, so when a matcher invokes `ctx.gen.word.noun()` with no
 * args, the helper sees `ctx === undefined` and falls back to `defaultLocale`.
 * The configured `nl` locale never reaches the helper.
 *
 * After B40's direction-A fix, the active `GeneratorContext` (carrying the
 * world's `locale`) is injected as the default `ctx` argument when the caller
 * does not supply one. Three bucket-3 helpers (`word.words`, `word.paragraph`,
 * `commerce.price`) have `ctx?` at a trailing index past index 1; the fix
 * uses a small per-helper ctx-slot table for those.
 *
 * Coverage of spec requirements (D6 — the file IS the regression test):
 *  - B40-R1 — `ctx.gen.word.noun()` with `locale: nl` does not return values
 *    from `defaultLocale.word.nouns`. Canonical issue #23 repro.        (RED today)
 *  - B40-R2 — explicit `ctx.gen.word.noun(ctx)` workaround precedence —
 *    byte-equal to the bound-default fix.                                (RED today)
 *  - B40-R3 — bucket-1, bucket-1 string helper, and bucket-3 helpers all
 *    forward the locale via `ctx.gen.<ns>.<fn>()`.                       (RED today)
 *  - B40-R4 — pure prng-only helpers are unaffected: identical output
 *    across `seed: 1` with and without `locale: nl`.                     (PASS today — guard)
 *  - B40-R5 — no-locale world still resolves to `defaultLocale`.         (PASS today — guard)
 *  - B40-R6 — direct helper calls with no ctx use the helper's own
 *    `?? defaultLocale` fallback.                                        (PASS today — guard)
 *  - B40-R7 — meta: this file IS the regression test. No separate test.
 *  - B40-R8 / B40-R9 — docs/changeset; reviewer-only. Skipped here.
 *
 * No `any`, no casts (architecture rule D1). Schemas are constructed once at
 * module scope (B39's reference-identity model).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, createPrng, generators } from "../../../src/index.js";
import { defaultLocale } from "../../../src/default-locale.js";
import { nl } from "@zod4-mock/locale-nl";

// ---------------------------------------------------------------------------
// Shared fixtures
//
// Capitalised defaultLocale.word.nouns set — the exact strings the helper
// emits today when ctx is dropped. The bug means an nl-configured world's
// `ctx.gen.word.noun()` produces values IN this set; the fix means it
// produces values NOT in this set (Markov-Dutch).
// ---------------------------------------------------------------------------

const DEFAULT_LOCALE_CAPITALISED_NOUNS = new Set(
  (defaultLocale.word.nouns ?? []).map((w) => w.charAt(0).toUpperCase() + w.slice(1)),
);

// Single-field item schema, used by B40-R1, B40-R2, B40-R5. Constructed at
// module scope so its reference identity is stable across worlds (B39).
const Item = z.object({
  id: z.uuid(),
  label: z.string(),
});

// Probe schema for B40-R3 bucket-1 / string-helper coverage. One field per
// affected namespace family from the spec's helper inventory.
const Probe = z.object({
  adj: z.string(), // word.adjective       (bucket 1)
  prodName: z.string(), // commerce.productName (bucket 1 string helper)
  pno: z.string(), // phone.number         (bucket 1)
});

// Probe schema for B40-R3 bucket-3 coverage (helpers with `ctx?` at an index
// > 1).
const Bucket3Probe = z.object({
  blurb: z.string(), // word.words(5)        (ctx-slot index 2)
  intro: z.string(), // word.paragraph(2)    (ctx-slot index 2)
  priceTag: z.string(), // commerce.price(1, 100) (ctx-slot index 3)
});

// Probe schema for B40-R4 — pure prng-only helpers.
const PrngOnlyProbe = z.object({
  uid: z.string(),
  code: z.string(),
  addr: z.string(),
  ip: z.string(),
});

// ---------------------------------------------------------------------------
// B40-R1 — `ctx.gen.word.noun()` resolves against the configured locale
// (canonical issue #23 repro)
// ---------------------------------------------------------------------------

describe("B40-R1 / ctx.gen.word.noun() honours the configured locale", () => {
  it("regression #23 — ctx.gen.word.noun() honours nl locale", () => {
    const world = createWorld({ seed: 1, locale: nl })
      .withSchema(Item, {
        matchers: {
          label: (ctx) => ctx.gen.word.noun(),
        },
      });

    const labels = Array.from(
      { length: 5 },
      () => world.generate(Item, { store: false }).label,
    );

    // Every label is a string.
    expect(labels.every((l) => typeof l === "string" && l.length > 0)).toBe(true);

    // None of the labels appear in the capitalised defaultLocale.word.nouns
    // set — i.e. the configured `nl` locale must have won over `defaultLocale`.
    // Today (pre-fix), every label is drawn from the default set; this
    // expectation will fail until B40 lands.
    for (const label of labels) {
      expect(
        DEFAULT_LOCALE_CAPITALISED_NOUNS.has(label),
        `label "${label}" came from defaultLocale.word.nouns — locale was dropped`,
      ).toBe(false);
    }
  });

  it("regression #23 — seed determinism preserved (no PRNG drift)", () => {
    // Two seed-matched worlds produce the same five values. This guards
    // against a buggy fix that injects an extra fork or advances the PRNG.
    const make = (): string[] => {
      const w = createWorld({ seed: 1, locale: nl }).withSchema(Item, {
        matchers: { label: (ctx) => ctx.gen.word.noun() },
      });
      return Array.from({ length: 5 }, () => w.generate(Item, { store: false }).label);
    };
    expect(make()).toEqual(make());
  });
});

// ---------------------------------------------------------------------------
// B40-R2 — explicit `ctx.gen.word.noun(ctx)` workaround precedence is
// byte-equal to the bound default after the fix
// ---------------------------------------------------------------------------

describe("B40-R2 / explicit ctx at the call-site keeps winning", () => {
  it("ctx.gen.word.noun() and ctx.gen.word.noun(ctx) produce identical output", () => {
    const worldA = createWorld({ seed: 1, locale: nl }).withSchema(Item, {
      matchers: { label: (ctx) => ctx.gen.word.noun() }, // bound default (the fix)
    });
    const worldB = createWorld({ seed: 1, locale: nl }).withSchema(Item, {
      matchers: { label: (ctx) => ctx.gen.word.noun(ctx) }, // explicit workaround
    });

    const a = Array.from(
      { length: 5 },
      () => worldA.generate(Item, { store: false }).label,
    );
    const b = Array.from(
      { length: 5 },
      () => worldB.generate(Item, { store: false }).label,
    );

    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// B40-R3 — every locale-aware helper receives the bound `GeneratorContext`
// by default (bucket-1, string helpers, and bucket-3 with trailing ctx-slot)
// ---------------------------------------------------------------------------

describe("B40-R3 / locale forwards to bucket-1 and string helpers", () => {
  it("bucket-1 helpers across word/commerce/phone honour the locale", () => {
    const enRecord = createWorld({ seed: 1 }).withSchema(Probe, {
      matchers: {
        adj: (ctx) => ctx.gen.word.adjective(),
        prodName: (ctx) => ctx.gen.commerce.productName(),
        pno: (ctx) => ctx.gen.phone.number(),
      },
    }).generate(Probe, { store: false });

    const nlRecord = createWorld({ seed: 1, locale: nl }).withSchema(Probe, {
      matchers: {
        adj: (ctx) => ctx.gen.word.adjective(),
        prodName: (ctx) => ctx.gen.commerce.productName(),
        pno: (ctx) => ctx.gen.phone.number(),
      },
    }).generate(Probe, { store: false });

    // The configured locale must observably change every bucket-1 output.
    // Today (pre-fix), both records are byte-identical because the nl locale
    // is dropped; these expectations will fail until B40 lands.
    expect(nlRecord.adj).not.toEqual(enRecord.adj);
    expect(nlRecord.prodName).not.toEqual(enRecord.prodName);
    expect(nlRecord.pno).not.toEqual(enRecord.pno);

    // Tight format pin for phone.number — Dutch numbers match
    // /^0[1-9][0-9]?-/ per the existing localization suite.
    expect(nlRecord.pno).toMatch(/^0[1-9][0-9]?-/);
  });
});

describe("B40-R3 / locale forwards to bucket-3 helpers (ctx slot past index 1)", () => {
  it("word.words(count) — ctx injected at slot 2; output is locale-specific", () => {
    const enWord = createWorld({ seed: 1 }).withSchema(Bucket3Probe, {
      matchers: {
        blurb: (ctx) => ctx.gen.word.words(5),
        intro: (ctx) => ctx.gen.word.paragraph(2),
        priceTag: (ctx) => ctx.gen.commerce.price(1, 100),
      },
    }).generate(Bucket3Probe, { store: false });

    const nlWord = createWorld({ seed: 1, locale: nl }).withSchema(Bucket3Probe, {
      matchers: {
        blurb: (ctx) => ctx.gen.word.words(5),
        intro: (ctx) => ctx.gen.word.paragraph(2),
        priceTag: (ctx) => ctx.gen.commerce.price(1, 100),
      },
    }).generate(Bucket3Probe, { store: false });

    // word.words(5) — five space-separated nouns. After the fix the nl
    // version is Markov-Dutch; pre-fix it equals the en record.
    expect(nlWord.blurb).not.toEqual(enWord.blurb);
    const blurbTokens = nlWord.blurb.split(" ");
    expect(blurbTokens).toHaveLength(5);
    // No token should be drawn from the default-locale noun set.
    for (const token of blurbTokens) {
      expect(
        DEFAULT_LOCALE_CAPITALISED_NOUNS.has(token),
        `blurb token "${token}" came from defaultLocale.word.nouns — locale was dropped at ctx-slot 2`,
      ).toBe(false);
    }
  });

  it("word.paragraph(sentenceCount) — ctx injected at slot 2", () => {
    const enWord = createWorld({ seed: 1 }).withSchema(Bucket3Probe, {
      matchers: {
        blurb: (ctx) => ctx.gen.word.words(5),
        intro: (ctx) => ctx.gen.word.paragraph(2),
        priceTag: (ctx) => ctx.gen.commerce.price(1, 100),
      },
    }).generate(Bucket3Probe, { store: false });

    const nlWord = createWorld({ seed: 1, locale: nl }).withSchema(Bucket3Probe, {
      matchers: {
        blurb: (ctx) => ctx.gen.word.words(5),
        intro: (ctx) => ctx.gen.word.paragraph(2),
        priceTag: (ctx) => ctx.gen.commerce.price(1, 100),
      },
    }).generate(Bucket3Probe, { store: false });

    // word.paragraph(2) — two sentences; locale must affect the result.
    expect(nlWord.intro).not.toEqual(enWord.intro);
    expect(typeof nlWord.intro).toBe("string");
    expect(nlWord.intro.length).toBeGreaterThan(0);
  });

  it("commerce.price(min, max) — ctx injected at slot 3; Dutch comma decimal", () => {
    const nlWord = createWorld({ seed: 1, locale: nl }).withSchema(Bucket3Probe, {
      matchers: {
        blurb: (ctx) => ctx.gen.word.words(5),
        intro: (ctx) => ctx.gen.word.paragraph(2),
        priceTag: (ctx) => ctx.gen.commerce.price(1, 100),
      },
    }).generate(Bucket3Probe, { store: false });

    // nl.commerce.formatPrice uses `€` and a comma decimal separator —
    // pre-fix, this returns a default-locale `$<n>.<dd>` string.
    expect(nlWord.priceTag).toMatch(/^€[0-9]+,[0-9]{2}$/);
    expect(nlWord.priceTag).not.toMatch(/^\$[0-9]+\.[0-9]{2}$/);
  });
});

// ---------------------------------------------------------------------------
// B40-R4 — helpers that take no `ctx` MUST be unaffected by the fix
// (PASS today; PASS after fix — regression guard)
// ---------------------------------------------------------------------------

describe("B40-R4 / pure prng-only helpers are unaffected by the locale", () => {
  it("prng-only helpers produce identical output across seed-matched worlds with and without a locale", () => {
    const recEn = createWorld({ seed: 1 })
      .withSchema(PrngOnlyProbe, {
        matchers: {
          uid: (ctx) => ctx.gen.string.uuid(),
          code: (ctx) => ctx.gen.string.alphanumeric(12),
          addr: (ctx) => ctx.gen.finance.bitcoinAddress(),
          ip: (ctx) => ctx.gen.internet.ipv4(),
        },
      })
      .generate(PrngOnlyProbe, { store: false });

    const recNl = createWorld({ seed: 1, locale: nl })
      .withSchema(PrngOnlyProbe, {
        matchers: {
          uid: (ctx) => ctx.gen.string.uuid(),
          code: (ctx) => ctx.gen.string.alphanumeric(12),
          addr: (ctx) => ctx.gen.finance.bitcoinAddress(),
          ip: (ctx) => ctx.gen.internet.ipv4(),
        },
      })
      .generate(PrngOnlyProbe, { store: false });

    // Locale has no observable effect on bucket-4 helpers.
    expect(recNl).toEqual(recEn);

    // And the values are well-formed (helpers did not crash on the
    // ctx-injection adapter for prng-only helpers — B40-R4's "MUST not
    // confuse pure-prng helpers" clause).
    expect(recNl.uid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(recNl.code).toHaveLength(12);
    expect(typeof recNl.addr).toBe("string");
    expect(recNl.ip).toMatch(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/);
  });
});

// ---------------------------------------------------------------------------
// B40-R5 — defaultLocale fallback path remains intact when no `locale` is
// configured. (PASS today; PASS after fix — regression guard.)
// ---------------------------------------------------------------------------

describe("B40-R5 / no-locale world keeps producing defaultLocale values", () => {
  it("ctx.gen.word.noun() in a no-locale world returns capitalised defaultLocale nouns", () => {
    const world = createWorld({ seed: 7 }).withSchema(Item, {
      matchers: { label: (ctx) => ctx.gen.word.noun() },
    });

    const labels = Array.from(
      { length: 5 },
      () => world.generate(Item, { store: false }).label,
    );

    for (const label of labels) {
      expect(
        DEFAULT_LOCALE_CAPITALISED_NOUNS.has(label),
        `label "${label}" was NOT in defaultLocale.word.nouns — no-locale fallback regressed`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// B40-R6 — defaultLocale remains the safety-net inside the helpers themselves
// (PASS today; PASS after fix — regression guard for direct-call shape.)
// ---------------------------------------------------------------------------

describe("B40-R6 / direct helper call with no ctx still resolves to defaultLocale", () => {
  it("generators.word.noun(prng) (no ctx) returns a capitalised defaultLocale noun", () => {
    const prng = createPrng(1);
    const value = generators.word.noun(prng);

    // The helper's own `(ctx?.locale ?? defaultLocale)` fallback must still
    // protect external callers that import and call the helper directly.
    expect(DEFAULT_LOCALE_CAPITALISED_NOUNS.has(value)).toBe(true);
  });
});
