import type { GeneratorContext, BoundGenerators, Prng } from "../types.js";
import * as generatorsData from "../generators/data/index.js";

// Maps <namespace>.<helper> → the positional index at which the helper accepts a
// ctx?: GeneratorContext arg, injected when the caller omits one. Slot semantics:
//   - number          — inject ctx at this index (past prng) if args[slot] is undefined.
//   - "no-args-only"  — inject ctx only when the caller passes zero args (the 2nd arg
//                       is ambiguous: a Gender string OR a GeneratorContext).
//   - (absent)        — prng-only helper; MUST NOT inject ctx (would clash with a
//                       positional param like string.alphanumeric(prng, length)).
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
  // lorem re-exports all word helpers, so apply the same slot table.
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

// Mutable per-generate() holder. The engine's field loop swaps state.prng/ctx in
// place per field; bound closures read these through the holder reference at call
// time, so a matcher on field B observes B's PRNG without rebinding.
export interface FieldState {
  prng: Prng;
  ctx: GeneratorContext;
  // Owning world, used only by the test-only __bindCount(world) seam.
  world: object;
}

// Test-only bindCount instrumentation; not public API.
let bindCount = 0;
const perWorldBindCounts: WeakMap<object, number> = new WeakMap();

export const __getBindCount = (): number => bindCount;

export const __resetBindCount = (): void => {
  bindCount = 0;
};

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
      out[name] = (...args: unknown[]) => fn(state.prng, ...args);
      continue;
    }

    if (slot === "no-args-only") {
      out[name] = (...args: unknown[]) =>
        args.length === 0 ? fn(state.prng, state.ctx) : fn(state.prng, ...args);
      continue;
    }

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

// The 14 namespace getters are hosted on a single shared prototype (not installed
// per call) — per-call Object.defineProperties forced hidden-class transitions and
// drove a large allocation regression. Per-call cost is one Object.create + one slot.
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

// Symbol-keyed so V8 keeps the target on the same hidden-class chain across calls.
const STATE_SLOT: unique symbol = Symbol("zod4-mock.fieldState");

interface LazyGenTarget extends Record<string, unknown> {
  [STATE_SLOT]: FieldState;
}

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
      // Cache as an own property shadowing the prototype getter so subsequent
      // reads skip this getter (no re-bind).
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

// Object.create(null) drops the Object.prototype chain so the namespace surface
// can't collide with built-in method names (hasOwnProperty, __proto__, …).
const LAZY_GEN_PROTO: object = Object.create(null) as object;
Object.defineProperties(LAZY_GEN_PROTO, NAMESPACE_DESCRIPTORS);

export function buildLazyGen(state: FieldState): BoundGenerators {
  const target = Object.create(LAZY_GEN_PROTO) as LazyGenTarget;
  target[STATE_SLOT] = state;
  return target as unknown as BoundGenerators;
}
