/**
 * @module world/bind-generators
 *
 * Generator binding layer — extracted from `engine.ts` under B60.
 *
 * Pure data + one pure function: no `WorldImpl` state, no `this`. Lifted
 * verbatim from the engine to make `engine.ts`'s residual mass actually
 * engine-shaped. See `wiki/research/reports/codebase-complexity-2026-06-01.md`
 * §3.3 / §3.4.
 */

import type { GeneratorContext, Prng } from "../types.js";

// ---------------------------------------------------------------------------
// B40 — per-helper ctx-slot table for bindGenerators
//
// Maps `<namespace>.<helper-name>` → the positional index at which the
// helper accepts a `ctx?: GeneratorContext` argument. `bindGenerators`'s
// Proxy adapter consults this table to decide whether (and where) to inject
// the active `GeneratorContext` when the caller does not supply one.
//
// Slot semantics:
//   - number       — bucket 1 / bucket 3: ctx-slot index past `prng`. The
//                    adapter injects boundCtx at this index if args[slot] is
//                    undefined. The dominant bucket-1 shape is slot 1.
//                    Bucket-3 helpers (word.words, word.paragraph,
//                    commerce.price) carry numeric/positional args before
//                    ctx, so their slots are 2 or 3.
//   - "no-args-only" — bucket 2 (person.firstName / middleName / fullName /
//                    prefix): the second arg is ambiguous (`Gender` string
//                    OR `GeneratorContext`). Inject boundCtx ONLY when the
//                    caller passes no args; any explicit arg (string Gender
//                    or ctx) wins verbatim. The Gender-string-without-locale
//                    residual is documented and deferred to B36.
//   - (absent)      — bucket 4: pure prng-only helpers. The adapter MUST
//                    NOT inject ctx; injecting an extra arg could clash
//                    with a numeric/string positional parameter (e.g.
//                    `string.alphanumeric(prng, length)`).
//
// The table is per-namespace, per-helper-name; an absent namespace or
// absent helper falls through to the bucket-4 safe default.
// ---------------------------------------------------------------------------

type CtxSlot = number | "no-args-only";

const CTX_SLOTS: Readonly<Record<string, Readonly<Record<string, CtxSlot>>>> = {
  word: {
    noun: 1,
    word: 1,
    adjective: 1,
    verb: 1,
    adverb: 1,
    conjunction: 1,
    interjection: 1,
    preposition: 1,
    sentence: 1,
    sample: 1,
    words: 2,
    paragraph: 2,
  },
  commerce: {
    department: 1,
    productAdjective: 1,
    productMaterial: 1,
    productName: 1,
    product: 1,
    productDescription: 1,
    price: 3,
  },
  person: {
    lastName: 1,
    suffix: 1,
    jobTitle: 1,
    jobArea: 1,
    jobType: 1,
    jobDescriptor: 1,
    gender: 1,
    bio: 1,
    firstName: "no-args-only",
    middleName: "no-args-only",
    fullName: "no-args-only",
    prefix: "no-args-only",
  },
  location: {
    street: 1,
    buildingNumber: 1,
    streetAddress: 1,
    secondaryAddress: 1,
    zipCode: 1,
    postalCode: 1,
    city: 1,
    state: 1,
    county: 1,
    country: 1,
    countryCode: 1,
    continent: 1,
    language: 1,
    timeZone: 1,
    direction: 1,
    cardinalDirection: 1,
    ordinalDirection: 1,
  },
  company: {
    name: 1,
    buzzAdjective: 1,
    buzzNoun: 1,
    buzzVerb: 1,
    buzzPhrase: 1,
    catchPhraseAdjective: 1,
    catchPhraseDescriptor: 1,
    catchPhraseNoun: 1,
    catchPhrase: 1,
  },
  finance: {
    currencyCode: 1,
    currencyName: 1,
    currencySymbol: 1,
    currencyNumericCode: 1,
    accountName: 1,
    transactionType: 1,
    transactionDescription: 1,
    iban: 1,
    bic: 1,
    creditCardNumber: 1,
  },
  date: {
    month: 1,
    weekday: 1,
    timeZone: 1,
  },
  color: {
    colorName: 1,
  },
  phone: {
    number: 1,
  },
  internet: {
    domainWord: 1,
    username: 1,
    displayName: 1,
    email: 1,
    exampleEmail: 1,
  },
  // `lorem` re-exports all `word` helpers, so apply the same slot table.
  lorem: {
    noun: 1,
    word: 1,
    adjective: 1,
    verb: 1,
    adverb: 1,
    conjunction: 1,
    interjection: 1,
    preposition: 1,
    sentence: 1,
    sample: 1,
    words: 2,
    paragraph: 2,
  },
};

// ---------------------------------------------------------------------------
// B36 — eager generator binding
//
// `bindNamespace` walks one namespace object once and produces a plain
// `Record<string, unknown>` whose function members are wrapped per
// `CTX_SLOTS[nsName]`. Non-function members (e.g. `internet.DOMAINS`,
// `word.TECH_WORDS`) are forwarded verbatim. The slot lookup happens at
// bind time, not call time — this replaces B40's double-Proxy machinery
// with a single eager pass.
//
// Bucket semantics are preserved verbatim from B40:
//   - slot === number       (bucket 1 / bucket 3): inject boundCtx at the
//                            declared ctx-slot index when the caller did
//                            not supply one;
//   - slot === "no-args-only" (bucket 2): inject boundCtx only when the
//                            caller passes zero args. The Gender-string-
//                            without-locale residual (B40 deferred to B36)
//                            is intentionally preserved here — fixing it
//                            requires a helper-signature change, which is
//                            out of scope for this refactor (chore);
//   - slot === undefined    (bucket 4): forward args verbatim, no ctx
//                            injection.
// ---------------------------------------------------------------------------

type CtxAwareFn = (prng: Prng, ...args: unknown[]) => unknown;

export function bindNamespace<T extends Readonly<Record<string, unknown>>>(
  ns: T,
  nsName: string,
  prng: Prng,
  boundCtx: GeneratorContext,
): {
  [K in keyof T]: T[K] extends (prng: Prng, ...args: infer P) => infer R ? (...args: P) => R : T[K];
} {
  const nsSlots = CTX_SLOTS[nsName];
  const out: Record<string, unknown> = {};

  for (const name of Object.keys(ns)) {
    const value: unknown = ns[name];

    if (typeof value !== "function") {
      out[name] = value;
      continue;
    }

    const fn = value as CtxAwareFn;
    const slot = nsSlots?.[name];

    if (slot === undefined) {
      // Bucket 4: pure-prng helpers and any unmapped helper. Forward args
      // verbatim — injecting an extra arg could clash with numeric/string
      // positional parameters (e.g. `string.alphanumeric(length)`).
      out[name] = (...args: unknown[]) => fn(prng, ...args);
      continue;
    }

    if (slot === "no-args-only") {
      // Bucket 2: `person.{firstName,middleName,fullName,prefix}`. The second
      // arg is ambiguous (`Gender` string OR `GeneratorContext`); inject
      // boundCtx ONLY when the caller passes no args. The Gender-string form
      // (`ctx.gen.person.firstName("male")`) does NOT pick up the configured
      // locale — known residual carried over from B40, intentionally deferred:
      // fixing it requires changing the helper signatures (a breaking change
      // out of scope for this refactor).
      out[name] = (...args: unknown[]) =>
        args.length === 0 ? fn(prng, boundCtx) : fn(prng, ...args);
      continue;
    }

    // Bucket 1 / Bucket 3 (numeric slot): inject boundCtx at the declared
    // ctx-slot index when the caller has not supplied one.
    const ctxArgIdx = slot - 1;
    out[name] = (...args: unknown[]) => {
      if (args[ctxArgIdx] === undefined) {
        const padded: unknown[] = [...args];
        while (padded.length < ctxArgIdx) padded.push(undefined);
        padded[ctxArgIdx] = boundCtx;
        return fn(prng, ...padded);
      }
      return fn(prng, ...args);
    };
  }

  return out as {
    [K in keyof T]: T[K] extends (prng: Prng, ...args: infer P) => infer R
      ? (...args: P) => R
      : T[K];
  };
}
