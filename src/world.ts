/**
 * @module world
 * The central context for one data-generation session.
 *
 * Schemas are the primary anchor. Register schemas with `withSchema`, then
 * generate data with `generate`. All generation is deterministic given the seed.
 *
 * ## Registration modes
 *
 * Primary:   `world.withSchema(Schema, { matchers })`
 * Relational: `world.withSchema(Schema, { relations: { name: OtherSchema }, matchers })`
 * Derived:   `world.withSchema(Schema, { from: SourceSchema, matchers })`
 *
 * ## Generation pipeline (per field)
 *
 * 0. `options.overrides` — eager per-field assignment. Primitive/array overrides
 *    land in `ctx.current` before sibling matchers run, so matchers can read
 *    them via `ctx.current.<sibling>`.
 * 1. Matchers registered via `withSchema`
 * 2. Per-schema key maps registered via `withKeyMap`
 * 3. Key-based generators (field name heuristics)
 * 4. Schema-based generator (Zod type introspection)
 * 5. `options.overrides` — final deep-merge (covers nested-object overrides
 *    that step 0 didn't eagerly consume)
 * 6. `options.transform` function
 */

import { z } from "zod";
import type { ZodTypeAny, input } from "zod";
import type {
  World,
  WorldOptions,
  GenerateOptions,
  Registry,
  GeneratorContext,
  BoundGenerators,
  KeyGenerator,
  Prng,
  SchemaKeyMap,
  SchemaOpts,
  ExplainResult,
} from "./types.js";
import { SchemaRegistry } from "./registry.js";
import { createPrng, fieldSeed } from "./prng.js";
import { generateFromSchema } from "./generators/schema/index.js";
import {
  def,
  checks,
  unwrap,
  resolveLazyChain,
} from "./generators/schema/zod-def.js";
import { deepMerge, deepEqual } from "./utils/merge.js";
import * as generatorsData from "./generators/data/index.js";
import { defaultLocale } from "./default-locale.js";
import { explainSchema } from "./explain.js";
import { PIPELINE, walkPipeline } from "./pipeline.js";

// ---------------------------------------------------------------------------
// B39 — module-global stable schema identity
// ---------------------------------------------------------------------------
//
// To satisfy B39-R1 (call-order independence ACROSS distinct schemas), the
// integer ID assigned to a `ZodTypeAny` reference must be the same in two
// independently constructed worlds even when their `generate(...)` call
// sequences differ — e.g. `worldA.generate(X)` vs
// `worldB.generate(Y); worldB.generate(X)` must produce the same value for
// `X`. A per-world counter cannot satisfy that: it would give X different IDs
// (worldA: 0, worldB: 1).
//
// The fix: assign each schema reference a process-stable integer ID via a
// **module-global** `WeakMap`. Schemas are GC'd naturally; the global counter
// monotonically advances. The per-world `schemaCallCounts` (below) stays
// per-world — it counts how many times THIS world has called `generate` on
// that schema (the "Nth call" component of the fork-key seed). The spec's
// B39-R3 language said both maps would be per-world; the call-order
// independence requirement (B39-R1) takes precedence and forces the ID map
// to be global. See the report at the bottom of the implementer commit.
//
// ---------------------------------------------------------------------------

const globalSchemaIds: WeakMap<ZodTypeAny, number> = new WeakMap();
let nextGlobalSchemaId = 0;

function getSchemaId(schema: ZodTypeAny): number {
  let id = globalSchemaIds.get(schema);
  if (id === undefined) {
    id = nextGlobalSchemaId++;
    globalSchemaIds.set(schema, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Internal schema registration record
// ---------------------------------------------------------------------------

interface NormalizedRelation {
  schema: ZodTypeAny;
  where: ((item: unknown) => boolean) | null;
}

interface SchemaReg {
  schema: ZodTypeAny;
  from: ZodTypeAny | null;
  sourceKey: string | null;
  relations: Record<string, NormalizedRelation>;
  matchers: Record<string, (ctx: GeneratorContext) => unknown>;
  regId: number;
}

const EMPTY_REG: SchemaReg = {
  schema: {} as ZodTypeAny,
  from: null,
  sourceKey: null,
  relations: {},
  matchers: {},
  regId: -1,
};

/**
 * B25 — internal discriminated union describing a schema's registration mode.
 * Returned by `WorldImpl.resolveMode(schema)`; consumed by the four
 * dispatchers (`generateSingleItem`, `generateArray`, `populate`'s explicit
 * primary-first variant, and `get`'s registered/not check). Not exported.
 */
type SchemaMode =
  | { kind: "derived"; regs: SchemaReg[] }
  | { kind: "primary"; reg: SchemaReg }
  | { kind: "ad-hoc" };

/**
 * B11: discriminate the bare-schema form (`relations: { post: Schema }`)
 * from the object form (`relations: { post: { schema, where? } }`). An entry
 * is the object form when it is a non-Zod object carrying a `schema` property
 * whose value is itself a Zod schema. A `ZodTypeAny` carries its definition
 * at `_zod.def` — we use that brand to discriminate.
 */
function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in (value as Record<string, unknown>)
  );
}

function normalizeRelationEntry(entry: unknown): NormalizedRelation {
  if (isZodSchema(entry)) {
    return { schema: entry, where: null };
  }
  if (
    typeof entry === "object" &&
    entry !== null &&
    "schema" in (entry as Record<string, unknown>)
  ) {
    const obj = entry as { schema: unknown; where?: (item: unknown) => boolean };
    if (!isZodSchema(obj.schema)) {
      throw new Error(
        "Invalid relations entry: `schema` must be a Zod schema reference.",
      );
    }
    return { schema: obj.schema, where: obj.where ?? null };
  }
  throw new Error(
    "Invalid relations entry: expected a Zod schema or `{ schema, where? }` object.",
  );
}

// ---------------------------------------------------------------------------
// Array constraint resolvers
// ---------------------------------------------------------------------------

function resolveMinRequired(schema: ZodTypeAny, defaultMin: number): number {
  let min = defaultMin;
  for (const c of checks(schema)) {
    if (c.check === "length_equals") return c.length!;
    if (c.check === "min_length" && c.minimum !== undefined) {
      min = Math.max(min, c.minimum);
    }
  }
  return min;
}

function resolveMaxAllowed(schema: ZodTypeAny, defaultMax: number): number {
  let max = defaultMax;
  for (const c of checks(schema)) {
    if (c.check === "length_equals") return c.length!;
    if (c.check === "max_length" && c.maximum !== undefined) {
      max = Math.min(max, c.maximum);
    }
  }
  return max;
}

/**
 * B43 — read the caller-side upper bound on an array schema, returning
 * `undefined` when the caller did not write `.max()` / `.length()`. Distinct
 * from {@link resolveMaxAllowed}, which folds in the library-side
 * `defaultArrayLength[1]` fallback. The primary-mode arm of `generateArray`
 * needs the raw caller intent so it can slice the registry to `.max()` /
 * `.length()` when present and leave it untouched when absent — slicing on
 * the library fallback would silently cap `world.populate(S, 10)` +
 * `world.generate(S.array())` at `defaultArrayLength[1]`.
 *
 * `.length(N)` sets both min and max to N, so it is treated as `max = N`
 * for slicing purposes (the call site rolls `target >= existingCount` and
 * the slice trims down to N). `.min()` alone leaves the upper bound
 * unconstrained — returns `undefined`.
 */
function readCallerMaxBound(schema: ZodTypeAny): number | undefined {
  let max: number | undefined;
  for (const c of checks(schema)) {
    if (c.check === "length_equals" && c.length !== undefined) return c.length;
    if (c.check === "max_length" && c.maximum !== undefined) {
      max = max === undefined ? c.maximum : Math.min(max, c.maximum);
    }
  }
  return max;
}

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

function bindNamespace<T extends Readonly<Record<string, unknown>>>(
  ns: T,
  nsName: string,
  prng: Prng,
  boundCtx: GeneratorContext,
): { [K in keyof T]: T[K] extends (prng: Prng, ...args: infer P) => infer R
  ? (...args: P) => R
  : T[K] } {
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

// ---------------------------------------------------------------------------
// WorldImpl
// ---------------------------------------------------------------------------

export class WorldImpl implements World {
  readonly prng: ReturnType<typeof createPrng>;
  readonly registry: Registry;

  private readonly schemaRegs: SchemaReg[] = [];
  /**
   * B39 — round-robin index for the derived-without-source pair picker
   * (`generateSingleItem`'s derived-fallback branch). Was historically named
   * `generationCounter` and used for PRNG fork keys too; under B39 those
   * fork keys moved to per-schema slots (`schemaCallCounts`), leaving this
   * counter with one remaining consumer: `pairs[idx]` at the derived-without-
   * source path. Incremented at the top of `generateSingleItem` and rolled
   * back by the B8 upsert short-circuit (D9 cache neutrality).
   */
  private derivedPairCounter = 0;
  /**
   * B39 — per-schema call index, advanced exactly once at each top-level
   * `generateSingleItem` ad-hoc / `generateArray` / outer-wrapper roll site.
   * Keyed by the same `ZodTypeAny` reference the call was made with. Two
   * `generate(X)` calls on one world get slots 1, 2, ...; an intervening
   * `generate(Y)` on a different schema reference leaves X's slot
   * untouched (the B39-R1 invariant). Scoped per-world so two worlds with
   * the same call sequence on X both see X's first call at slot 1.
   *
   * NB: the schema *identity* component of the fork key (`<id>`) is a
   * module-global `WeakMap` (see `getSchemaId` above). The per-world map
   * holds only the call count.
   */
  private readonly schemaCallCounts: WeakMap<ZodTypeAny, number> = new WeakMap();
  private readonly rootSeed: number;

  private readonly customKeyGenerators: Map<string, KeyGenerator> = new Map();
  private readonly schemaKeyMaps: Map<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > = new Map();
  private readonly relationPools: Map<string, unknown[]> = new Map();
  private readonly pendingCounts: Map<ZodTypeAny, number> = new Map();
  /**
   * B8 — per-pair upsert map for derived schemas registered with `from:`.
   * Outer key: derived schema reference. Inner key: source identity (the
   * source reference itself, or `source[sourceKey]` when declared). The
   * stored value is the post-transform derived record — the same reference
   * that lives in the registry (D8 — see `wiki/decisions.md`).
   */
  private readonly derivedUpsert: Map<ZodTypeAny, Map<unknown, unknown>> = new Map();
  private lazyCache = new WeakMap<ZodTypeAny, ZodTypeAny>();
  /**
   * Effective storage mode for the current outer `generate` call. When `false`,
   * `generateAndStorePrimary` and `generateDerivedRecord` skip their
   * `registry.store` side-effect. Propagates through nested recursion; scoped
   * to the outer call via try/finally in `WorldImpl.generate`.
   */
  private effectiveStore = true;

  constructor(private readonly options: WorldOptions = {}) {
    this.rootSeed = (options || {}).seed ?? Math.floor(Math.random() * 0xffffffff);
    this.prng = createPrng(this.rootSeed);
    this.registry = new SchemaRegistry(this.prng.fork("registry"));
    for (const [k, fn] of Object.entries(options.generators ?? {})) {
      this.customKeyGenerators.set(k.toLowerCase(), fn);
    }
  }

  /**
   * B39 — assign a stable identity to `schema` (lazily, on first sight) and
   * return the next per-schema call slot for the three fork-key sites
   * (`generateSingleItem` ad-hoc, `generateArray`, outer-wrapper roll).
   *
   * @param schema  The outer schema reference the caller invoked
   *                `generate(...)` with — NOT a re-resolved inner type. Using
   *                the outer reference preserves identity across `lazy`
   *                re-resolutions and `.optional()` / `.array()` wrappers.
   * @param commit  When `true` (default) the slot is consumed and the
   *                per-schema counter advances. When `false`, the next slot
   *                that *would* be assigned is returned without mutating the
   *                counter — useful for peek-before-cache-check patterns.
   *                B39 currently always commits and rolls back on cache hit
   *                via `rollbackSchemaSlot`; the parameter is here for
   *                future use.
   */
  private nextSchemaSlot(
    schema: ZodTypeAny,
    commit: boolean = true,
  ): { id: number; slot: number } {
    const id = getSchemaId(schema);
    const slot = (this.schemaCallCounts.get(schema) ?? 0) + 1;
    if (commit) {
      this.schemaCallCounts.set(schema, slot);
    }
    return { id, slot };
  }

  // -------------------------------------------------------------------------
  // withSchema
  // -------------------------------------------------------------------------

  withSchema<
    TSchema extends ZodTypeAny,
    TSource extends ZodTypeAny | undefined = undefined,
    TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
  >(schema: TSchema, opts?: SchemaOpts<TSchema, TSource, TRelations>): this {
    const from = (opts?.from as ZodTypeAny | undefined) ?? null;
    const sourceKey = (opts?.sourceKey as string | undefined) ?? null;
    const rawRelations = (opts?.relations ?? {}) as Record<string, unknown>;
    const relations: Record<string, NormalizedRelation> = {};
    for (const [relName, entry] of Object.entries(rawRelations)) {
      relations[relName] = normalizeRelationEntry(entry);
    }
    const matchers = (opts?.matchers ?? {}) as unknown as Record<
      string,
      (ctx: GeneratorContext) => unknown
    >;
    this.schemaRegs.push({
      schema,
      from,
      sourceKey,
      relations,
      matchers,
      regId: this.schemaRegs.length,
    });
    return this;
  }

  withGenerators(map: Record<string, KeyGenerator>): this {
    for (const [k, fn] of Object.entries(map)) {
      this.customKeyGenerators.set(k.toLowerCase(), fn);
    }
    return this;
  }

  withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this {
    const existing = this.schemaKeyMaps.get(schema) ?? {};
    this.schemaKeyMaps.set(schema, {
      ...existing,
      ...(map as Record<string, (ctx: GeneratorContext) => unknown>),
    });
    return this;
  }

  // -------------------------------------------------------------------------
  // populate
  // -------------------------------------------------------------------------

  populate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    count: number,
    factory?: (index: number) => GenerateOptions<z.infer<TSchema>>,
  ): this {
    // B10-R6: `populate`'s contract is to write the registry. A factory return
    // including `store: false` MUST be silently ignored — strip the field
    // before threading the options into the generate helpers.
    const factoryOpts = factory
      ? (i: number): GenerateOptions<unknown> => {
          const raw = factory(i) as GenerateOptions<unknown> & { store?: boolean };
          const { store: _ignored, ...rest } = raw;
          return rest;
        }
      : undefined;

    // `populate` historically inverts the standard derived-first precedence:
    // if a schema is registered as both primary and derived, the primary path
    // wins here (whereas `generateSingleItem` and `generateArray` prefer
    // derived). `resolveMode` returns derived-first; the explicit primary
    // re-check below preserves byte-identical behaviour without forcing
    // `resolveMode` to carry an order-flipping parameter.
    const primaryRegs = this.findPrimaryRegs(schema);
    if (primaryRegs.length > 0) {
      for (let i = 0; i < count; i++) {
        const opts = factoryOpts ? factoryOpts(i) : undefined;
        this.generateAndStorePrimary(schema, primaryRegs[0]!, opts);
      }
      return this;
    }

    const mode = this.resolveMode(schema);
    switch (mode.kind) {
      case "derived": {
        const reg = mode.regs[0]!;
        const sources = this.registry.all(reg.from!);
        // Use the count to limit how many we derive, or derive from all if count is large
        const N = Math.min(count, sources.length);
        for (let i = 0; i < N; i++) {
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          const result = this.generateDerivedRecord(schema, reg, sources[i], i, opts);
          this.registry.store(schema, result as input<TSchema>);
        }
        break;
      }
      case "primary":
        // Unreachable: the explicit primary check above returns first.
        break;
      case "ad-hoc":
        // Default to primary if not registered
        for (let i = 0; i < count; i++) {
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          this.generateAndStorePrimary(schema, null, opts);
        }
        break;
    }
    return this;
  }

  // -------------------------------------------------------------------------
  // populateFrom
  // -------------------------------------------------------------------------

  populateFrom<TDerived extends ZodTypeAny, TSource extends ZodTypeAny>(
    derivedSchema: TDerived,
    sourceSchema: TSource,
    predicate?: (item: z.infer<TSource>) => boolean,
    factory?: (source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>,
  ): this {
    // B13-R6: snapshot the source bucket at call start so mid-loop inserts
    // (a matcher side-effect, an auto-provisioned source) do not extend the
    // iteration of the current call.
    const snapshot = [...this.registry.all(sourceSchema)];
    // B13-R2: filter by predicate if present.
    const sources = predicate ? snapshot.filter(predicate) : snapshot;

    for (const source of sources) {
      // B13-R8: strip any `store: false` returned by the factory — populateFrom
      // always writes, mirroring populate's contract (B10-R6).
      const factoryReturn = factory?.(source);
      const { store: _ignored, ...rest } =
        (factoryReturn ?? {}) as GenerateOptions<z.infer<TDerived>> & {
          store?: boolean;
        };
      // B13-R4 idempotence: delegate to generate, which hits B8's per-pair
      // upsert on a repeat call with the same source identity.
      this.generate(derivedSchema, {
        ...rest,
        source,
      } as GenerateOptions<z.infer<TDerived>>);
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // generate
  // -------------------------------------------------------------------------

  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<z.infer<TSchema>>,
  ): z.infer<TSchema> {
    // B10-R2/R4: scope the effective store mode to this outer call. When the
    // caller passes `store: false`, this mode propagates through nested
    // recursion (generateObjectFields / generateArray / ctx.generate which
    // re-enters this method); restore the previous value on exit so a separate
    // top-level call is unaffected. B10-R5: explicit `store: true` overrides
    // an inherited `store: false` (used by `world.get` to force storage on its
    // create-path delegate call).
    return this.withEffectiveStore(options?.store, () => {
      let current: ZodTypeAny = schema;
      let d = def(current);
      const outerWrappers: Array<"optional" | "nullable"> = [];

      while (d.innerType && (d.type === "optional" || d.type === "nullable")) {
        outerWrappers.push(d.type);
        current = d.innerType;
        d = def(current);
      }

      current = resolveLazyChain(current, this.lazyCache);
      d = def(current);

      if (d.type === "array") {
        if (outerWrappers.length > 0) {
          // B39 — site 3: outer-wrapper optional/nullable roll. Key on the
          // outer `schema` reference (the `.optional()` wrapper) so the Nth
          // call to the same `.optional()` schema reuses the same fork key
          // regardless of intervening `generate(Y)` calls.
          const { id, slot } = this.nextSchemaSlot(schema);
          const prng = this.prng.fork(`wrap:${id}:${slot}`);
          const optProb = this.options.optionalProbability ?? 0.2;
          for (const wrapper of outerWrappers) {
            if (prng.random() < optProb) {
              // No counter mutation on skip — the per-schema slot was already
              // advanced by `nextSchemaSlot` above (the next call gets slot+1).
              return (wrapper === "optional" ? undefined : null) as z.infer<TSchema>;
            }
          }
        }
        return this.generateArray(
          d.element!,
          current,
          options as GenerateOptions<unknown[]> | undefined,
        ) as z.infer<TSchema>;
      }

      return this.generateSingleItem(
        schema,
        options as GenerateOptions<unknown>,
      ) as z.infer<TSchema>;
    });
  }

  // -------------------------------------------------------------------------
  // explain — read-only, PRNG-neutral per-field decision summary (B16)
  // -------------------------------------------------------------------------

  explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema> {
    // Use the most recent registration (last `withSchema` wins for matchers,
    // mirroring how `generateObjectFields` resolves `reg.matchers`).
    const primaryRegs = this.findPrimaryRegs(schema);
    const reg = primaryRegs.length > 0 ? primaryRegs[primaryRegs.length - 1]! : null;
    const schemaKeyMap =
      this.schemaKeyMaps.get(schema) ??
      (this.schemaKeyMaps.get(unwrap(schema)) as
        | Record<string, (ctx: GeneratorContext) => unknown>
        | undefined) ??
      {};

    return explainSchema(schema, {
      matchers: reg?.matchers ?? {},
      schemaKeyMap,
      customKeyGenerators: this.customKeyGenerators,
      relations: reg?.relations ?? {},
    });
  }

  // -------------------------------------------------------------------------
  // get — find an existing matching record, or generate-and-store one
  // -------------------------------------------------------------------------

  get<TSchema extends ZodTypeAny>(
    schema: TSchema,
    predicate?: Partial<input<TSchema>>,
  ): z.infer<TSchema> {
    const pred = (predicate ?? {}) as Record<string, unknown>;
    const keys = Object.keys(pred);
    const matches = (item: z.infer<TSchema>): boolean => {
      const record = item as Record<string, unknown>;
      return keys.every((k) => deepEqual(record[k], pred[k]));
    };

    const existing = this.registry.find(schema, matches);
    if (existing !== undefined) return existing;

    // B10-R5: `world.get`'s create path MUST always store regardless of any
    // ambient store mode — its idempotence (B6-R7) requires the created record
    // to be discoverable by a later find/get.
    const created = this.generate(
      schema,
      predicate
        ? ({ overrides: predicate, store: true } as GenerateOptions<z.infer<TSchema>>)
        : ({ store: true } as GenerateOptions<z.infer<TSchema>>),
    );

    const isRegistered = this.resolveMode(schema).kind !== "ad-hoc";

    if (!isRegistered) {
      // `generate` does not store ad-hoc, unregistered schemas — store the
      // created record ourselves so a later `find`/`get` can discover it.
      this.registry.store(schema, created as input<TSchema>);
      return created;
    }

    // Registered schemas are stored by `generate`, but the instance it returns
    // is a post-merge copy distinct from the one in the registry. Return the
    // stored instance so subsequent `get` calls resolve by reference.
    const stored = this.registry.find(schema, matches);
    return stored ?? created;
  }

  // -------------------------------------------------------------------------
  // Private: registration lookups
  // -------------------------------------------------------------------------

  private findPrimaryRegs(schema: ZodTypeAny): SchemaReg[] {
    return this.schemaRegs.filter((r) => r.schema === schema && r.from === null);
  }

  private findDerivedRegs(schema: ZodTypeAny): SchemaReg[] {
    return this.schemaRegs.filter((r) => r.schema === schema && r.from !== null);
  }

  // -------------------------------------------------------------------------
  // Private: schema-mode resolution (B25)
  //
  // Tagged union over the three registration modes. Replaces the
  // `findDerivedRegs(...).length > 0 ? ... : findPrimaryRegs(...).length > 0
  // ? ... : ad-hoc` cascade that previously appeared in `generateSingleItem`,
  // `generateArray`, and `populate` (with `populate` using the inverted
  // primary-first precedence — see its call site for the explicit handling).
  //
  // Derived-first precedence matches `generateSingleItem` and `generateArray`'s
  // historical dispatch order. Operates on whatever schema reference it is
  // given — callers handle the two-level (`schema` then `targetSchema`)
  // fallback themselves where they need it.
  // -------------------------------------------------------------------------

  private resolveMode(schema: ZodTypeAny): SchemaMode {
    const derivedRegs = this.findDerivedRegs(schema);
    if (derivedRegs.length > 0) return { kind: "derived", regs: derivedRegs };
    const primaryRegs = this.findPrimaryRegs(schema);
    if (primaryRegs.length > 0) return { kind: "primary", reg: primaryRegs[0]! };
    return { kind: "ad-hoc" };
  }

  // -------------------------------------------------------------------------
  // Private: effective-store scope helper
  // -------------------------------------------------------------------------

  /**
   * B10 — push/pop the {@link effectiveStore} flag for the duration of `fn`,
   * encapsulating the state machine described in B10-R2/R4/R5. When `value` is
   * `undefined` no push/pop happens (the call inherits the ambient mode); when
   * `value` is `true` or `false` the flag is set for the duration of `fn` and
   * restored in `finally`.
   *
   * The try/finally is what makes the B10 transitive-suppression contract
   * scoped to one outer `generate` call.
   */
  private withEffectiveStore<R>(value: boolean | undefined, fn: () => R): R {
    if (value === undefined) return fn();
    const previous = this.effectiveStore;
    this.effectiveStore = value;
    try {
      return fn();
    } finally {
      this.effectiveStore = previous;
    }
  }

  // -------------------------------------------------------------------------
  // Private: generators binding
  // -------------------------------------------------------------------------

  /**
   * B36 — eager generator binding.
   *
   * Walks every namespace in `generatorsData` once and builds an object whose
   * function members are wrapped per `CTX_SLOTS` (bucket 1/2/3) and whose
   * non-function members (e.g. `internet.DOMAINS`, `word.TECH_WORDS`) are
   * forwarded verbatim. Replaces B40's double-Proxy machinery — the slot
   * lookup is done once at bind time rather than on every property access.
   *
   * B40's ctx-forwarding contract is preserved byte-identically. In
   * particular, the bucket-2 `person.{firstName,middleName,fullName,prefix}`
   * helpers continue to forward `boundCtx` **only** when the caller passes
   * zero args — the Gender-string-without-locale residual carried over from
   * B40 is intentionally preserved (fixing it requires a helper-signature
   * change, which is out of scope for this refactor).
   */
  private bindGenerators(
    prng: ReturnType<typeof createPrng>,
    boundCtx: GeneratorContext,
  ): BoundGenerators {
    return {
      color: bindNamespace(generatorsData.color, "color", prng, boundCtx),
      commerce: bindNamespace(generatorsData.commerce, "commerce", prng, boundCtx),
      company: bindNamespace(generatorsData.company, "company", prng, boundCtx),
      date: bindNamespace(generatorsData.date, "date", prng, boundCtx),
      finance: bindNamespace(generatorsData.finance, "finance", prng, boundCtx),
      internet: bindNamespace(generatorsData.internet, "internet", prng, boundCtx),
      location: bindNamespace(generatorsData.location, "location", prng, boundCtx),
      lorem: bindNamespace(generatorsData.lorem, "lorem", prng, boundCtx),
      person: bindNamespace(generatorsData.person, "person", prng, boundCtx),
      phone: bindNamespace(generatorsData.phone, "phone", prng, boundCtx),
      string: bindNamespace(generatorsData.string, "string", prng, boundCtx),
      system: bindNamespace(generatorsData.system, "system", prng, boundCtx),
      vehicle: bindNamespace(generatorsData.vehicle, "vehicle", prng, boundCtx),
      word: bindNamespace(generatorsData.word, "word", prng, boundCtx),
    };
  }

  // -------------------------------------------------------------------------
  // Private: context construction
  //
  // recordPrng — stable per-record PRNG used for relation resolution.
  //   Calling ctx.related("owner") must return the SAME owner for all
  //   fields in one record. We fork from recordPrng (not fieldPrng) so the
  //   pick is field-independent.
  // fieldPrng  — field-seeded PRNG used for all data generation.
  // -------------------------------------------------------------------------

  private makeFieldCtx(
    reg: SchemaReg,
    source: unknown,
    recordPrng: ReturnType<typeof createPrng>,
    fieldPrng: ReturnType<typeof createPrng>,
    fieldPath: string,
    recordId: string,
    current?: Record<string, unknown>,
  ): GeneratorContext {
    const related = (<T = Record<string, unknown>>(relName: string): T =>
      this.resolveRelated<T>(reg, recordPrng, recordId, relName)) as GeneratorContext["related"];
    related.many = <T = unknown>(relName: string, count: number): T[] =>
      this.resolveRelatedMany<T>(reg, recordPrng, recordId, relName, count);
    // B40: build the ctx first (with a placeholder `gen`), then replace `gen`
    // with a properly-bound proxy that captures THIS ctx as its `boundCtx`.
    // The Proxy adapter injects this ctx (carrying `locale`, `current`, etc.)
    // as the default `ctx?` arg for every locale-aware helper, so matcher
    // calls like `ctx.gen.word.noun()` honour the configured locale.
    const ctx: GeneratorContext = {
      prng: fieldPrng,
      gen: {} as BoundGenerators,
      source,
      registry: this.registry,
      fieldPath,
      optionalProbability: this.options.optionalProbability ?? 0.2,
      related,
      generate: <S extends ZodTypeAny>(s: S, o?: GenerateOptions<z.infer<S>>): z.infer<S> => {
        const nextPath = o?.fieldPath ?? (o?.fieldPath === "" ? "" : fieldPath);
        return this.generate(s, { ...o, fieldPath: nextPath });
      },
      recursionLimit: this.options.recursionLimit ?? 5,
      current: (current ?? {}) as Partial<any>,
      locale: this.options.locale ?? defaultLocale,
    };
    (ctx as { gen: BoundGenerators }).gen = this.bindGenerators(fieldPrng, ctx);
    return ctx;
  }

  // -------------------------------------------------------------------------
  // Private: relation resolution
  // -------------------------------------------------------------------------

  private resolveRelated<T = Record<string, unknown>>(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
  ): T {
    const { items, prng } = this.resolveRelationPool(reg, recordPrng, recordId, relName, "single");
    if (items.length === 0) return undefined as T;
    const pickedIdx = prng.int(0, items.length - 1);
    return items[pickedIdx]! as T;
  }

  private resolveRelatedMany<T = unknown>(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
    count: number,
  ): T[] {
    const { items, prng } = this.resolveRelationPool(
      reg,
      recordPrng,
      recordId,
      relName,
      "many",
      count,
    );
    return prng.sample(items, count) as T[];
  }

  /**
   * Shared snapshot+fork pipeline for `ctx.related` (kind="single") and
   * `ctx.related.many` (kind="many"). Builds the per-record candidate pool —
   * applying `where` once before caching (B11-R3 / B11-R4 / B11-R7) — and
   * returns it alongside a per-relation PRNG fork.
   *
   * Diverges by `kind`:
   * - cache key suffix (`""` vs `":many"`),
   * - auto-provision: single calls `ensurePrimaryRecord` when the registry is
   *   empty; many runs an explicit shortfall loop up to `count` (and skips
   *   under `where`, since auto-provision cannot guarantee the predicate),
   * - PRNG fork key (`rel:<name>` vs `rel-many:<name>`),
   * - empty-pool throw threshold (`< 1` vs `< count`).
   *
   * Self-referential relations are exempt from auto-provision (would recurse)
   * and from the empty-pool throw (B5-R6 / B11-R6); callers handle the empty
   * pool themselves.
   */
  private resolveRelationPool(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
    kind: "single" | "many",
    count?: number,
  ): { items: unknown[]; prng: Prng } {
    const rel = reg.relations[relName];
    if (!rel) {
      throw new Error(
        `Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`,
      );
    }
    const relSchema = rel.schema;
    const where = rel.where;
    const isSelfRef = relSchema === reg.schema;

    const cacheKey = kind === "many" ? `${recordId}:${relName}:many` : `${recordId}:${relName}`;
    let items = this.relationPools.get(cacheKey);

    if (!items) {
      if (kind === "single") {
        if (this.registry.count(relSchema) === 0) {
          // A self-referential relation (the schema relates to itself, e.g. a
          // category whose parent is another category) must NOT auto-provision:
          // generating a new record would re-enter this matcher with the
          // registry still empty and recurse forever. Instead the first record
          // simply has no related instance yet — later records reference the
          // earlier ones already stored. The matcher handles the empty case
          // (e.g. `ctx.related("parent")?.id ?? null`).
          if (isSelfRef) {
            this.relationPools.set(cacheKey, []);
            items = [];
          } else {
            const provisioned = this.ensurePrimaryRecord(relSchema);
            // B10-R4: when the outer call opted out of storage, the
            // auto-provisioned record was NOT written to the registry. Use
            // the in-memory value directly so the matcher still sees a
            // related instance.
            if (!this.effectiveStore && provisioned !== undefined) {
              items = [provisioned];
            }
          }
        }
      } else {
        // kind === "many": auto-provision the shortfall until at least `count`
        // records exist — except for self-referential relations (would recurse,
        // see the single guard above). Under `where`, auto-provision cannot
        // guarantee the predicate is satisfied (B11-R6) — we do not attempt to
        // coax matchers into producing predicate-satisfying records; if the
        // filtered pool falls short, we throw below.
        const want = count ?? 0;
        if (!isSelfRef && !where) {
          const relReg = this.findPrimaryRegs(relSchema)[0] ?? null;
          if (!this.effectiveStore) {
            // B10-R4: under `store: false`, the registry is not written;
            // collect provisioned records directly into the pool so the
            // matcher still sees them.
            const pool: unknown[] = [...this.registry.all(relSchema)];
            while (pool.length < want) {
              const provisioned = this.generateAndStorePrimary(relSchema, relReg);
              pool.push(provisioned);
            }
            items = pool;
          } else {
            while (this.registry.count(relSchema) < want) {
              this.generateAndStorePrimary(relSchema, relReg);
            }
          }
        }
      }
      if (!items) {
        items = [...this.registry.all(relSchema)];
      }
      // B11-R3 / B11-R4 / B11-R7: apply `where` once, here, when building the
      // snapshot. Filtering before caching means subsequent cache hits do not
      // re-evaluate the predicate (D9 — cache neutrality).
      if (where) {
        items = items.filter((it) => where(it));
      }
      // B11-R6: empty / undersupplied filtered pool throws for
      // non-self-referential relations. The throw happens before the PRNG fork
      // so no PRNG state is consumed.
      if (where && !isSelfRef) {
        if (kind === "single" && items.length === 0) {
          throw new Error(
            `No related '${relName}' matches the \`where\` predicate. ` +
              `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`,
          );
        }
        if (kind === "many" && items.length < (count ?? 0)) {
          throw new Error(
            `No related '${relName}' matches the \`where\` predicate ` +
              `(requested ${count}, available ${items.length}). ` +
              `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`,
          );
        }
      }
      this.relationPools.set(cacheKey, items);
    }

    // Derive a stable per-relation PRNG so all fields in one record pick the
    // same related entity (single) or set (many). The `rel-many:` prefix on
    // the many path keeps its fork independent of the single path's `rel:`
    // fork — D4 / D10 byte-identical fork-key shape.
    const forkKey = kind === "many" ? `rel-many:${relName}` : `rel:${relName}`;
    const prng = recordPrng.fork(forkKey);
    return { items, prng };
  }

  private ensurePrimaryRecord(schema: ZodTypeAny): unknown | undefined {
    if (this.registry.count(schema) > 0) return undefined;
    const reg = this.findPrimaryRegs(schema)[0] ?? null;
    return this.generateAndStorePrimary(schema, reg);
  }

  // -------------------------------------------------------------------------
  // Private: primary record generation
  // -------------------------------------------------------------------------

  private generateAndStorePrimary(
    schema: ZodTypeAny,
    reg: SchemaReg | null,
    options?: GenerateOptions<unknown>,
  ): unknown {
    const pending = this.pendingCounts.get(schema) ?? 0;
    const recordIndex = this.registry.count(schema) + pending;
    this.pendingCounts.set(schema, pending + 1);

    try {
      const effectiveRegId = reg?.regId ?? -1;
      const recordId = `reg${effectiveRegId}#${recordIndex}`;
      const recordPrng = createPrng(fieldSeed(this.rootSeed, recordId, ""));
      const effectiveReg = reg ?? EMPTY_REG;
      const fieldPath = options?.fieldPath ?? recordId;
      let result = this.generateObjectFields(
        schema,
        effectiveReg,
        undefined,
        recordPrng,
        recordId,
        fieldPath,
        options?.overrides as Record<string, unknown>,
      );
      if (options?.transform) {
        result = options.transform(result as input<ZodTypeAny>);
      }
      // B10-R2/R4: skip the registry write when the outer call opted out.
      if (this.effectiveStore) {
        this.registry.store(schema, result);
      }
      return result;
    } finally {
      const currentPending = this.pendingCounts.get(schema) ?? 1;
      this.pendingCounts.set(schema, currentPending - 1);
    }
  }

  // -------------------------------------------------------------------------
  // Private: derived record generation
  // -------------------------------------------------------------------------

  private generateDerivedRecord(
    schema: ZodTypeAny,
    reg: SchemaReg,
    source: unknown,
    sourceIndex: number,
    options?: GenerateOptions<unknown>,
  ): unknown {
    const recordId = `dreg${reg.regId}#${sourceIndex}`;
    const recordPrng = createPrng(fieldSeed(this.rootSeed, recordId, ""));
    let result = this.generateObjectFields(
      schema,
      reg,
      source,
      recordPrng,
      recordId,
      recordId,
      options?.overrides as Record<string, unknown>,
    );
    if (options?.transform) {
      result = options.transform(result as input<ZodTypeAny>);
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Private: object field generation
  //
  // recordPrng — used for relation resolution (stable across fields).
  // The field PRNG is forked from recordPrng per field key.
  // fieldPathPrefix — prepended to the field key for ctx.fieldPath (e.g. "reg0#0.lines").
  // -------------------------------------------------------------------------

  private generateObjectFields(
    schema: ZodTypeAny,
    reg: SchemaReg,
    source: unknown,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    fieldPathPrefix: string,
    overrides?: Record<string, unknown>,
  ): unknown {
    const depth = fieldPathPrefix ? fieldPathPrefix.split(".").filter(Boolean).length : 0;
    if (depth > (this.options.recursionLimit ?? 5)) return null;

    let current = resolveLazyChain(schema, this.lazyCache);
    let d = def(current);

    if (d.type !== "object") {
      return generateFromSchema(
        current,
        this.makeFieldCtx(reg, source, recordPrng, recordPrng, fieldPathPrefix, recordId),
      );
    }

    const shape = d.shape!;
    const result: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldPrng = recordPrng.fork(key);
      const fieldPath = fieldPathPrefix ? `${fieldPathPrefix}.${key}` : key;
      const fs = fieldSchema as ZodTypeAny;
      const fieldCtx = this.makeFieldCtx(reg, source, recordPrng, fieldPrng, fieldPath, recordId, result);
      result[key] = walkPipeline(PIPELINE, {
        fieldSchema: fs, fieldName: key, fieldCtx, fieldOverride: overrides?.[key],
        reg, outerSchema: schema, resolvedSchema: current,
        customKeyGenerators: this.customKeyGenerators, schemaKeyMaps: this.schemaKeyMaps,
        optionalProbability: this.options.optionalProbability ?? 0.2,
        dryRun: false, state: { inner: fs }, explainMeta: {},
      }).value;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Private: array generation
  // -------------------------------------------------------------------------

  private generateArray(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    options?: GenerateOptions<unknown[]>,
  ): unknown[] {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (this.options.recursionLimit ?? 5)) return [];

    // B39 — site 2: key the array's PRNG on the outer `arraySchema` reference
    // (NOT the inner element schema). Keying on the inner schema would
    // coalesce `z.array(X).min(3)` and `z.array(X).max(5)` into one slot
    // bucket; keying on the outer ZodArray reference preserves their
    // independence.
    const { id: arrayId, slot: arraySlot } = this.nextSchemaSlot(arraySchema);
    const genPrng = this.prng.fork(`array:${arrayId}:${arraySlot}`);

    const [defMin, defMax] = this.options.defaultArrayLength ?? [1, 5];
    const mode = this.resolveMode(innerSchema);

    switch (mode.kind) {
      // -------------------------------------------------------------------
      // Derived mode: one output per source record
      // -------------------------------------------------------------------
      case "derived": {
        // Collect all (source, reg, sourceIndex) pairs from existing sources
        type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };
        const pairs: SourcePair[] = [];

        for (const reg of mode.regs) {
          const sources = this.registry.all(reg.from!);
          for (let i = 0; i < sources.length; i++) {
            pairs.push({ source: sources[i], reg, sourceIndex: i });
          }
        }

        // Auto-provision more sources if min constraint requires it
        const minRequired = resolveMinRequired(arraySchema, defMin);
        while (pairs.length < minRequired) {
          const regIdx = pairs.length % mode.regs.length;
          const reg = mode.regs[regIdx]!;
          const fromSchema = reg.from!;
          const fromReg = this.findPrimaryRegs(fromSchema)[0] ?? null;
          const sourceIndex = this.registry.count(fromSchema);
          const newSource = this.generateAndStorePrimary(fromSchema, fromReg);
          pairs.push({ source: newSource, reg, sourceIndex });
        }

        return pairs.map(({ source, reg, sourceIndex }) =>
          this.generateDerivedRecord(innerSchema, reg, source, sourceIndex),
        );
      }

      // -------------------------------------------------------------------
      // Primary mode: generate N items, store in registry, return all
      // -------------------------------------------------------------------
      case "primary": {
        // B38: per-index overrides on a primary-registered array schema are
        // silently dropped today (generateAndStorePrimary is called without
        // options). Refuse the unsafe call shape loudly so the caller is
        // steered to `world.populate(schema, count, factory)` — the API that
        // actually applies per-record overrides. The guard fires BEFORE any
        // record is generated so no partial work lands in the registry.
        if (Array.isArray(options?.overrides) && options.overrides.length > 0) {
          throw new Error(
            "Per-index overrides on a primary-registered array schema are not supported on world.generate. " +
              "Use world.populate(schema, count, factory) instead — see docs/api-reference.md → .populate.",
          );
        }

        const existingCount = this.registry.count(innerSchema);

        const minRequired = resolveMinRequired(arraySchema, defMin);
        const maxAllowed = resolveMaxAllowed(arraySchema, defMax);
        const target = Math.max(
          existingCount,
          genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)),
        );

        // B44: under store:false, the loop below would never terminate —
        // generateAndStorePrimary skips the registry write (B10-R4 transitive
        // suppression) so `registry.count(innerSchema)` never advances past
        // `existingCount`. Generate `target` records directly via Array.from
        // and return them; the store-on path below is byte-identical.
        if (!this.effectiveStore) {
          return Array.from({ length: target }, () =>
            this.generateAndStorePrimary(innerSchema, mode.reg),
          );
        }

        while (this.registry.count(innerSchema) < target) {
          this.generateAndStorePrimary(innerSchema, mode.reg);
        }

        const all = this.registry.all(innerSchema);

        // B43: honour caller-side `.max()` / `.length()` by slicing the
        // returned array. Only slice when the caller actually wrote a bound —
        // we MUST NOT slice on the library-side `defMax` fallback (otherwise
        // `world.generate(S.array())` would silently cap at `defaultArrayLength[1]`
        // even after `world.populate(S, 10)`). `.min()` alone leaves the upper
        // bound unconstrained; `.length(N)` is treated as `max = N`. D8 is
        // preserved by construction: every returned record was first stored
        // via `generateAndStorePrimary`, so the slice is a read-only narrowing
        // of an already-D8-consistent registry view.
        const callerMax = readCallerMaxBound(arraySchema);
        return callerMax !== undefined && all.length > callerMax
          ? all.slice(0, callerMax)
          : all;
      }

      // -------------------------------------------------------------------
      // Ad-hoc: no registration — pure schema-based generation
      // -------------------------------------------------------------------
      case "ad-hoc":
        break;
    }

    let N = defMin;
    let maxN = defMax;
    for (const c of checks(arraySchema)) {
      if (c.check === "length_equals") {
        N = c.length!;
        maxN = N;
        break;
      }
      if (c.check === "min_length" && c.minimum !== undefined) N = Math.max(N, c.minimum);
      if (c.check === "max_length" && c.maximum !== undefined) maxN = Math.min(maxN, c.maximum);
    }
    N = genPrng.int(Math.min(N, maxN), Math.max(N, maxN));

    let result = Array.from({ length: N }, (_, i) => {
      const elemPrng = genPrng.fork(`[${i}]`);
      const nextPath = options?.fieldPath ? `${options.fieldPath}.[${i}]` : `[${i}]`;
      return this.generate(innerSchema, {
        prng: elemPrng,
        fieldPath: nextPath,
      });
    });

    if (options?.overrides) {
      const overrides = options.overrides as any[];
      result = result.map((item, i) => {
        const ov = overrides[i];
        return ov !== undefined ? (deepMerge(item, ov) as any) : item;
      });
    }

    if (options?.transform) {
      result = result.map(options.transform as any);
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Private: single-item generation
  // -------------------------------------------------------------------------

  /**
   * Thin dispatcher: resolves the schema mode (with-source override / no-source
   * derived / primary / ad-hoc), routes to one of the four private branch
   * helpers, and applies the trailing `overrides` + `transform` pass when the
   * branch helper hasn't already done so internally.
   *
   * Responsibilities kept here (per B24-R6):
   *   - recursion-depth guard,
   *   - `derivedPairCounter++` increment at top,
   *   - lazy-resolve `while` producing `targetSchema`,
   *   - two-level `findDerivedRegs` / `findPrimaryRegs` detection,
   *   - `sourceOverride` extraction,
   *   - B8 upsert cache short-circuit (D9 / B8-R9 cache-neutral — rolls back
   *     `derivedPairCounter--` so an upsert hit advances no counter),
   *   - trailing `overrides` deep-merge + `transform` application.
   */
  private generateSingleItem(schema: ZodTypeAny, options?: GenerateOptions<unknown>): unknown {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (this.options.recursionLimit ?? 5)) return null;

    // B39 — only the derived-without-source pair picker (below, at the
    // `pairs[idx]` site) still reads this counter. The three former
    // PRNG-fork-key consumers (ad-hoc, array, outer-wrap) moved to
    // `schemaCallCounts` via `nextSchemaSlot`.
    this.derivedPairCounter++;

    let current = resolveLazyChain(schema, this.lazyCache);
    let d = def(current);
    const targetSchema = current;

    // Two-level fallback for the lazy-resolve interaction: prefer registrations
    // keyed on the outer `schema` reference; fall back to the lazy-resolved
    // `targetSchema` if the outer reference has no registration. The two-level
    // check is specific to this dispatcher (lazy-resolved schemas may have been
    // registered under either reference); `resolveMode` itself operates on
    // whatever schema it is given.
    let mode = this.resolveMode(schema);
    if (mode.kind === "ad-hoc" && targetSchema !== schema) {
      mode = this.resolveMode(targetSchema);
    }

    // The `source` field on GenerateOptions is intentionally typed `any` at
    // registration time (B7's input/output type story); the cast is preserved
    // verbatim from the pre-B24 dispatcher (B24-R9 — no new `any`).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceOverride = (options as any)?.source;

    let result: unknown;
    let transformApplied = false;

    if (sourceOverride !== undefined) {
      // B8 upsert cache short-circuit lives here (dispatcher) so the
      // `derivedPairCounter--` rollback runs before we call into the helper.
      // D9 / B8-R9: an upsert hit must leave no observable per-world
      // generation state behind.
      const derivedRegs = mode.kind === "derived" ? mode.regs : [];
      const reg = (derivedRegs[0] ?? { ...EMPTY_REG, schema }) as SchemaReg;
      const sourceKey = reg.sourceKey;
      const identity =
        sourceKey !== null && sourceKey !== undefined
          ? (sourceOverride as Record<string, unknown>)[sourceKey]
          : sourceOverride;
      const isUnique = options?.unique !== false;
      const canUseUpsert = isUnique && this.effectiveStore;

      if (canUseUpsert) {
        const existing = this.derivedUpsert.get(schema)?.get(identity);
        if (existing !== undefined) {
          this.derivedPairCounter--;
          return existing;
        }
      }

      result = this.generateWithSourceOverride(schema, derivedRegs, sourceOverride, options);
      transformApplied = true;
    } else {
      switch (mode.kind) {
        case "derived":
          result = this.generateDerivedAutoSource(schema, mode.regs, options);
          transformApplied = true;
          break;
        case "primary":
          result = this.generatePrimary(schema, mode.reg, options);
          transformApplied = true;
          break;
        case "ad-hoc":
          result = this.generateAdHoc(schema, targetSchema, options);
          break;
      }
    }

    if (options?.overrides) result = deepMerge(result, options.overrides);
    if (options?.transform && !transformApplied) {
      result = options.transform(result as input<ZodTypeAny>);
    }
    return result;
  }

  /**
   * Branch 1 — `sourceOverride !== undefined`: B8 with-source per-(DerivedSchema,
   * source-identity) upsert path.
   *
   * Preserved contracts:
   *   - B8-R1 / B8-R4: writes the derived record to the registry and records
   *     the `(identity → derived)` entry in `derivedUpsert` when
   *     `effectiveStore === true && isUnique === true`.
   *   - B8-R7 / B10: under `effectiveStore === false`, both the `registry.store`
   *     and the `derivedUpsert` write are suppressed.
   *   - D8 / B14: `generateDerivedRecord` applies `options.overrides` and
   *     `options.transform` internally; the dispatcher's trailing block is
   *     gated by `transformApplied = true` so neither is re-applied here.
   *
   * The upsert cache short-circuit and `derivedPairCounter--` rollback live in
   * the dispatcher above (D9 / B8-R9).
   */
  private generateWithSourceOverride(
    schema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    source: unknown,
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    const reg = (derivedRegs[0] ?? { ...EMPTY_REG, schema }) as SchemaReg;
    const sourceKey = reg.sourceKey;
    const identity =
      sourceKey !== null && sourceKey !== undefined
        ? (source as Record<string, unknown>)[sourceKey]
        : source;
    const isUnique = options?.unique !== false;

    // `generateDerivedRecord` already applies `options.overrides` (via
    // `generateObjectFields`'s per-field deep-merge) AND `options.transform`
    // — see B14 (D8). Trust its return value here; do NOT re-apply overrides
    // or transform in this branch (would double-apply for any non-idempotent
    // transform).
    const result = this.generateDerivedRecord(schema, reg, source, 0, options);

    // B8-R7 / B10: when the outer call opted out of storage, do NOT touch
    // the registry and do NOT write to the upsert map — both side effects
    // are suppressed together so a later default-mode call cannot resolve
    // to a record that isn't in the registry.
    if (this.effectiveStore) {
      this.registry.store(schema, result as input<ZodTypeAny>);
      if (isUnique) {
        let inner = this.derivedUpsert.get(schema);
        if (!inner) {
          inner = new Map<unknown, unknown>();
          this.derivedUpsert.set(schema, inner);
        }
        inner.set(identity, result);
      }
    }

    return result;
  }

  /**
   * Branch 2 — `derivedRegs.length > 0` with no explicit source: the no-source
   * derived auto-source path.
   *
   * Preserved contracts:
   *   - Auto-provisions one source per distinct `reg.from` with an empty
   *     source registry, via `generateAndStorePrimary`.
   *   - B20 local-capture: under `store: false` the auto-provision write is
   *     suppressed, so the freshly generated source is captured in a local
   *     `Map<ZodTypeAny, unknown>` keyed by `reg.from`. Multiple derivedRegs
   *     sharing the same `reg.from` reuse one captured source.
   *   - Pair-pick by `(derivedPairCounter - 1) % pairs.length` round-robin.
   *   - D8 / B14: `generateDerivedRecord` applies `options.overrides` /
   *     `options.transform` internally; the dispatcher's trailing block is
   *     gated by `transformApplied = true`.
   *   - B24-R3 (closes B21): under `if (this.effectiveStore)`, write the
   *     derived record to the registry. Mirrors the with-source branch's
   *     existing line. The new store does NOT touch `derivedUpsert` — that
   *     map is keyed on explicit source identity and the no-source path has
   *     none.
   *   - B10-R4 / B20-R2: the new store call is gated on `this.effectiveStore`,
   *     preserving transitive `store: false` suppression.
   */
  private generateDerivedAutoSource(
    schema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    // Pick first available source across all derived regs, auto-provisioning
    // if needed. Under `store: false` (B10-R4 transitive suppression) the
    // `generateAndStorePrimary` call generates but does NOT write to the
    // registry — so we capture the freshly generated source locally and
    // fall back to it when the registry read still returns []. The local
    // map is keyed by `reg.from` so multiple derivedRegs sharing the same
    // source schema reuse one auto-provisioned source (matching the
    // existing behaviour: `registry.count(reg.from) === 0` skips after
    // the first call writes).
    const captured = new Map<ZodTypeAny, unknown>();
    for (const reg of derivedRegs) {
      if (this.registry.count(reg.from!) === 0 && !captured.has(reg.from!)) {
        const fromReg = this.findPrimaryRegs(reg.from!)[0] ?? null;
        const fresh = this.generateAndStorePrimary(reg.from!, fromReg);
        captured.set(reg.from!, fresh);
      }
    }

    // Collect all (source, reg, index) pairs and pick by derivedPairCounter.
    // B20-R4: the non-empty path reads from the registry exactly as today;
    // the local capture is consulted only when the registry is still empty
    // after the auto-provision attempt (i.e. only under `store: false`).
    type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };
    const pairs: SourcePair[] = [];
    for (const reg of derivedRegs) {
      const sources = this.registry.all(reg.from!);
      if (sources.length > 0) {
        for (let i = 0; i < sources.length; i++) {
          pairs.push({ source: sources[i], reg, sourceIndex: i });
        }
      } else if (captured.has(reg.from!)) {
        pairs.push({ source: captured.get(reg.from!), reg, sourceIndex: 0 });
      }
    }

    const idx = (this.derivedPairCounter - 1) % pairs.length;
    const { source, reg, sourceIndex } = pairs[idx]!;
    const result = this.generateDerivedRecord(schema, reg, source, sourceIndex, options);

    // B24-R3 (closes B21): the no-source-derived path now stores the derived
    // record by default, symmetric with the with-source branch. The store is
    // gated on `effectiveStore` so `world.generate(D, { store: false })`
    // still suppresses both source and derived writes (B10-R4 / B20-R2).
    // Does NOT touch `derivedUpsert` — that map is keyed on explicit source
    // identity, which the no-source path does not have.
    if (this.effectiveStore) {
      this.registry.store(schema, result as input<ZodTypeAny>);
    }

    return result;
  }

  /**
   * Branch 3 — `primaryRegs.length > 0`: registered-primary path.
   *
   * Delegates to `generateAndStorePrimary`, which applies `options.transform`
   * internally and stores under `if (this.effectiveStore)`. The dispatcher's
   * trailing `transform` is suppressed via `transformApplied = true`.
   */
  private generatePrimary(
    schema: ZodTypeAny,
    primaryReg: SchemaReg,
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    return this.generateAndStorePrimary(schema, primaryReg, options);
  }

  /**
   * Branch 4 — ad-hoc fallback for an unregistered schema.
   *
   * Preserved contracts:
   *   - D4 / D10 / B39 Site 1: keys the ad-hoc PRNG on the OUTER `schema`
   *     reference via `nextSchemaSlot(schema)`, NOT on the lazy-resolved
   *     `targetSchema`. The outer reference is stable across `z.lazy(...)`
   *     re-resolutions, matching the spec's identity model.
   *   - Fork key literal shape: `adhoc:${id}:${slot}` (D10 / B39 pins this).
   *   - Dispatches on `def(targetSchema).type === "object"` to either
   *     `generateObjectFields` (objects, threading through `options?.overrides`)
   *     or `generateFromSchema` (non-objects).
   *   - The dispatcher applies the trailing `overrides` + `transform` block
   *     to the result of this branch (it does not set `transformApplied`).
   */
  private generateAdHoc(
    schema: ZodTypeAny,
    targetSchema: ZodTypeAny,
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    const { id: adhocId, slot: adhocSlot } = this.nextSchemaSlot(schema);
    const recordId = `adhoc:${adhocId}:${adhocSlot}`;
    const adHocPrng = this.prng.fork(recordId);
    const fieldPath = options?.fieldPath ?? recordId;
    if (def(targetSchema).type === "object") {
      return this.generateObjectFields(
        targetSchema,
        EMPTY_REG,
        undefined,
        adHocPrng,
        recordId,
        fieldPath,
        options?.overrides as Record<string, unknown>,
      );
    }
    return generateFromSchema(
      targetSchema,
      this.makeFieldCtx(EMPTY_REG, undefined, adHocPrng, adHocPrng, fieldPath, recordId),
    );
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createWorld(options?: WorldOptions): World {
  return new WorldImpl(options ?? {});
}
