/**
 * @module world/bind-generators
 *
 * Generator binding layer — extracted from `engine.ts`, then
 * re-shaped to a **lazy per-namespace holder** pattern.
 *
 * ## Lazy per-namespace getters with mutable `{ prng, ctx }` holder
 *
 * Previously, `engine.ts` rebuilt all 14 generator namespaces (each with ~10
 * helper closures) on **every field** of every record — `makeFieldCtx`
 * called `bindNamespace` 14 times per field. A 4-field schema therefore
 * allocated ~560 closures per `generate()` call. That cost showed up in
 * `pnpm --filter=@zod4-mock/site bench` as a ~7× slowdown vs the earlier
 * (lazy Proxy) shape — bisected to commit `9717326`.
 *
 * The fix is structural: one `FieldState` holder per outer `generate()` call,
 * one shared `BoundGenerators` (`buildLazyGen`) built lazily on top, and the
 * field loop **mutates** the holder's `prng` / `ctx` in place before each
 * pipeline step. Each namespace is a property-getter that materialises its
 * closures **on first touch** and caches the result on the object —
 * subsequent touches in the same call read the cache. The bound closures
 * read `state.prng` / `state.ctx` at **call time** (through the holder
 * reference), not at bind time, so per-field state swaps without rebuilding.
 *
 * Why per-namespace and not per-method? Matchers typically touch a small
 * handful of namespaces (`person`, `internet`, `location`, …); per-method
 * granularity would create ~10 getters per touched namespace for marginal
 * win on a workload that already short-circuits to zero materialisations
 * when nothing reads `ctx.gen`.
 *
 * ## Invariants
 *
 * - **Determinism** — the holder reads `state.prng` at call time,
 *   so a per-field PRNG fork is observed by every matcher that calls
 *   `ctx.gen.<ns>.<fn>()` from that field. No bind-time snapshotting.
 * - **ctx-forwarding contract** — preserved byte-identically. The four
 *   `CTX_SLOTS` buckets keep their meanings:
 *     - `number`        — bucket 1 / 3: inject `ctx` at the declared slot
 *                         index when the caller didn't supply one.
 *     - `"no-args-only"` — bucket 2: inject `ctx` only when the caller
 *                         passes zero args. The Gender-string-without-locale
 *                         residual is preserved.
 *     - absent          — bucket 4: forward args verbatim, no `ctx`
 *                         injection.
 * - **No `any`** — `BoundGenerators` is the typed `CoreGenerators`
 *   produced by `Object.defineProperty`-installed getters.
 *
 * ## Test seam
 *
 * The module exposes a private `bindCount` counter that increments each
 * time a namespace's closures are materialised, plus `__getBindCount` /
 * `__resetBindCount` / `__bindCount(world)` helpers used by the regression
 * tests. The counter is **not** part of the public API (no export from
 * `src/index.ts`).
 */

import type { GeneratorContext, BoundGenerators, Prng } from "../types.js";
import * as generatorsData from "../generators/data/index.js";

// ---------------------------------------------------------------------------
// Per-helper ctx-slot table for bindGenerators
//
// Maps `<namespace>.<helper-name>` → the positional index at which the
// helper accepts a `ctx?: GeneratorContext` argument. The binder consults
// this table to decide whether (and where) to inject the active
// `GeneratorContext` when the caller does not supply one.
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
//                    residual is documented and deferred.
//   - (absent)      — bucket 4: pure prng-only helpers. The adapter MUST
//                    NOT inject ctx; injecting an extra arg could clash
//                    with a numeric/string positional parameter (e.g.
//                    `string.alphanumeric(prng, length)`).
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
// FieldState: the mutable per-`generate()` holder
//
// One allocation per outer `generate()` call. The engine's field loop swaps
// `state.prng` and `state.ctx` in place at the top of each field iteration;
// bound closures read these through the holder reference at call time, so a
// matcher running on field B observes B's per-field PRNG even though the
// binder was set up before any field was visited.
// ---------------------------------------------------------------------------

export interface FieldState {
  prng: Prng;
  ctx: GeneratorContext;
  /**
   * Owning `WorldImpl` reference — used solely for the test-only
   * `__bindCount(world)` instrumentation seam so per-world counts work
   * even when materialisation happens outside `withFieldStateScope` (e.g.
   * `populate` calls `generateAndStorePrimary` directly).
   */
  world: object;
}

// ---------------------------------------------------------------------------
// Test-only `bindCount` instrumentation
//
// Module-scope counter incremented exactly once per `(state × namespace)`
// materialisation. Lazy-bound namespaces materialise their closure set on
// first touch and cache the result on the holder object, so the counter is
// a faithful proxy for "how much work the binder did".
//
// Reset between tests via `__resetBindCount()`. NOT part of the public API
// (no entry in `src/index.ts`, no doc on `docs/api-reference.md`).
//
// The map keeps a per-world view so a test that runs multiple worlds in
// parallel can read the bind count for a specific world. The `unknown`
// world value is the public `World`/`createWorld` return; we don't need a
// concrete type since the counter is keyed by reference.
// ---------------------------------------------------------------------------

let bindCount = 0;
const perWorldBindCounts: WeakMap<object, number> = new WeakMap();

export const __getBindCount = (): number => bindCount;

export const __resetBindCount = (): void => {
  bindCount = 0;
};

/**
 * Test-only — returns the cumulative bind count for a given world. Counts
 * are attributed via `FieldState.world` at materialisation time, so each
 * world's count is independent. Returns `0` for worlds that have never
 * materialised a namespace.
 */
export function __bindCount(world: unknown): number {
  if (world !== null && typeof world === "object") {
    return perWorldBindCounts.get(world) ?? 0;
  }
  return bindCount;
}

function recordMaterialisation(world: object): void {
  bindCount += 1;
  perWorldBindCounts.set(world, (perWorldBindCounts.get(world) ?? 0) + 1);
}

// ---------------------------------------------------------------------------
// Namespace binder
//
// `bindNamespace` walks one namespace object once and produces a typed
// object whose function members are wrapped per `CTX_SLOTS[nsName]`. The
// wrapped functions read `state.prng` / `state.ctx` at call time (through
// the holder reference) rather than at bind time — this is what lets the
// engine mutate the holder per field without rebuilding the closure set.
//
// Bucket semantics are preserved verbatim (see CTX_SLOTS docstring).
// ---------------------------------------------------------------------------

type CtxAwareFn = (prng: Prng, ...args: unknown[]) => unknown;

export function bindNamespace<T extends Readonly<Record<string, unknown>>>(
  ns: T,
  nsName: string,
  state: FieldState,
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
      // Bucket 4: forward args verbatim — no ctx injection.
      out[name] = (...args: unknown[]) => fn(state.prng, ...args);
      continue;
    }

    if (slot === "no-args-only") {
      // Bucket 2: inject boundCtx only when the caller passes zero args.
      // Gender-string-without-locale residual preserved.
      out[name] = (...args: unknown[]) =>
        args.length === 0 ? fn(state.prng, state.ctx) : fn(state.prng, ...args);
      continue;
    }

    // Bucket 1 / Bucket 3 (numeric slot): inject boundCtx at the declared
    // slot index when the caller has not supplied one.
    const ctxArgIdx = slot - 1;
    out[name] = (...args: unknown[]) => {
      if (args[ctxArgIdx] === undefined) {
        const padded: unknown[] = [...args];
        while (padded.length < ctxArgIdx) padded.push(undefined);
        padded[ctxArgIdx] = state.ctx;
        return fn(state.prng, ...padded);
      }
      return fn(state.prng, ...args);
    };
  }

  return out as {
    [K in keyof T]: T[K] extends (prng: Prng, ...args: infer P) => infer R
      ? (...args: P) => R
      : T[K];
  };
}

// ---------------------------------------------------------------------------
// buildLazyGen (prototype-based shape)
//
// Returns a typed `BoundGenerators` whose 14 namespace properties are
// exposed as lazy getters hosted on a single **module-global prototype**
// object. The first read of any namespace materialises its closure set (via
// `bindNamespace`), caches it as an own enumerable data property on the
// instance (shadowing the prototype getter), and increments the `bindCount`
// instrumentation.
//
// Hosting the 14 getters on a shared prototype (rather than installing them
// per call via `Object.defineProperties`) reduces the per-call allocation
// cost to one `Object.create` + one hidden state-slot assignment. Round-1
// installed the descriptor map on every fresh target — that allocated ~14
// own enumerable property slots per call and forced hidden-class transitions
// on every generate(), driving simple-tier avg to ~45 µs and the
// allocation-test delta to ~12.9 MB / 1000 calls. Round-2 amortises the 14
// descriptors onto a single shared prototype installed once at module load.
//
// The `gen` object's lifetime is one outer `generate()` call. The engine
// allocates one `FieldState` + one `gen` at the entry point; the field loop
// mutates `state.prng` / `state.ctx` per field; the wrapped closures
// transparently observe the mutation through the holder reference.
// ---------------------------------------------------------------------------

const NAMESPACES = [
  "color",
  "commerce",
  "company",
  "date",
  "finance",
  "internet",
  "location",
  "lorem",
  "person",
  "phone",
  "string",
  "system",
  "vehicle",
  "word",
] as const;

type NamespaceName = (typeof NAMESPACES)[number];

// Hidden slot for the per-target `FieldState` holder. Stored as a symbol-
// keyed property so V8 keeps the target on the same hidden-class chain
// across calls (each `buildLazyGen` returns an object with exactly this one
// own property at creation time, and the prototype carries the 14 namespace
// getters).
const STATE_SLOT: unique symbol = Symbol("zod4-mock.fieldState");

interface LazyGenTarget extends Record<string, unknown> {
  [STATE_SLOT]: FieldState;
}

// Module-global getter functions, one per namespace. The getters live on
// the shared prototype forever — never duplicated per instance.
const NAMESPACE_GETTERS: Readonly<Record<NamespaceName, () => unknown>> = (() => {
  const out: Record<string, () => unknown> = {};
  for (const ns of NAMESPACES) {
    const namespaceName: NamespaceName = ns;
    out[ns] = function (this: LazyGenTarget): unknown {
      const state = this[STATE_SLOT];
      const bound = bindNamespace(
        generatorsData[namespaceName] as Readonly<Record<string, unknown>>,
        namespaceName,
        state,
      );
      recordMaterialisation(state.world);
      // Install the materialised namespace as an own enumerable data
      // property on the instance, shadowing the prototype getter.
      // Subsequent reads of `target.<ns>` skip this getter (no re-bind, no
      // second `recordMaterialisation`).
      Object.defineProperty(this, namespaceName, {
        enumerable: true,
        configurable: true,
        writable: false,
        value: bound,
      });
      return bound;
    };
  }
  return out as Readonly<Record<NamespaceName, () => unknown>>;
})();

// Module-global property-descriptor map — used **once at module load** to
// populate the shared prototype. Each descriptor reuses the shared getter
// from `NAMESPACE_GETTERS`. Not exported.
const NAMESPACE_DESCRIPTORS: PropertyDescriptorMap = (() => {
  const out: PropertyDescriptorMap = {};
  for (const ns of NAMESPACES) {
    out[ns] = {
      enumerable: false,
      configurable: true,
      get: NAMESPACE_GETTERS[ns],
    };
  }
  return out;
})();

// The single shared prototype that all `buildLazyGen` instances inherit
// from. `Object.create(null)` removes the `Object.prototype` chain so the
// namespace surface can't collide with built-in method names
// (`hasOwnProperty`, `__proto__`, …). The 14 namespace getters live here
// forever; per-call allocation is just one `Object.create`.
const LAZY_GEN_PROTO: object = Object.create(null) as object;
Object.defineProperties(LAZY_GEN_PROTO, NAMESPACE_DESCRIPTORS);

export function buildLazyGen(state: FieldState): BoundGenerators {
  // Per-call allocation: one `Object.create(LAZY_GEN_PROTO)` + one hidden
  // state-slot assignment. The 14 namespace getters are inherited from the
  // shared prototype — no per-call `Object.defineProperty` work on the
  // target.
  const target = Object.create(LAZY_GEN_PROTO) as LazyGenTarget;
  target[STATE_SLOT] = state;
  return target as unknown as BoundGenerators;
}
