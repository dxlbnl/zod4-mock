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
  SchemaKeyMap,
  SchemaOpts,
  ExplainResult,
} from "./types.js";
import { SchemaRegistry } from "./registry.js";
import { createPrng, fieldSeed } from "./prng.js";
import { generateFromSchema } from "./generators/schema/index.js";
import { generateFromKey } from "./generators/index.js";
import { def, checks, unwrap, applyModifiers } from "./generators/schema/zod-def.js";
import { deepMerge, deepEqual } from "./utils/merge.js";
import * as generatorsData from "./generators/data/index.js";
import { defaultLocale } from "./default-locale.js";
import { explainSchema } from "./explain.js";

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

    const primaryRegs = this.findPrimaryRegs(schema);
    const derivedRegs = this.findDerivedRegs(schema);

    if (primaryRegs.length > 0) {
      for (let i = 0; i < count; i++) {
        const opts = factoryOpts ? factoryOpts(i) : undefined;
        this.generateAndStorePrimary(schema, primaryRegs[0]!, opts);
      }
    } else if (derivedRegs.length > 0) {
      const reg = derivedRegs[0]!;
      const sources = this.registry.all(reg.from!);
      // Use the count to limit how many we derive, or derive from all if count is large
      const N = Math.min(count, sources.length);
      for (let i = 0; i < N; i++) {
        const opts = factoryOpts ? factoryOpts(i) : undefined;
        const result = this.generateDerivedRecord(schema, reg, sources[i], i, opts);
        this.registry.store(schema, result as input<TSchema>);
      }
    } else {
      // Default to primary if not registered
      for (let i = 0; i < count; i++) {
        const opts = factoryOpts ? factoryOpts(i) : undefined;
        this.generateAndStorePrimary(schema, null, opts);
      }
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
    // top-level call is unaffected.
    const previousEffectiveStore = this.effectiveStore;
    if (options?.store === false) {
      this.effectiveStore = false;
    } else if (options?.store === true) {
      // B10-R5: explicit `store: true` overrides an inherited `store: false`
      // (used by `world.get` to force storage on its create-path delegate call).
      this.effectiveStore = true;
    }
    try {
      let current: ZodTypeAny = schema;
      let d = def(current);
      const outerWrappers: Array<"optional" | "nullable"> = [];

      while (d.innerType && (d.type === "optional" || d.type === "nullable")) {
        outerWrappers.push(d.type);
        current = d.innerType;
        d = def(current);
      }

      while (d.type === "lazy") {
        let resolved = this.lazyCache.get(current);
        if (!resolved) {
          resolved = d.getter!();
          this.lazyCache.set(current, resolved);
        }
        current = resolved;
        d = def(current);
      }

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
    } finally {
      this.effectiveStore = previousEffectiveStore;
    }
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

    const isRegistered =
      this.findPrimaryRegs(schema).length > 0 || this.findDerivedRegs(schema).length > 0;

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
  // Private: generators binding
  // -------------------------------------------------------------------------

  private bindGenerators(
    prng: ReturnType<typeof createPrng>,
    boundCtx: GeneratorContext,
  ): BoundGenerators {
    const boundCache: Record<string, any> = {};

    return new Proxy({} as BoundGenerators, {
      get: (_target, ns: string) => {
        if (boundCache[ns]) return boundCache[ns];

        const nsObj = (generatorsData as Record<string, any>)[ns];
        if (!nsObj) return undefined;

        const nsSlots = CTX_SLOTS[ns];

        const boundNs = new Proxy(nsObj, {
          get: (target, name: string) => {
            const fn = target[name];
            if (typeof fn !== "function") return fn;

            const slot = nsSlots?.[name];

            // Bucket 4 (no entry in the table): forward verbatim. Pure-prng
            // helpers MUST NOT receive an injected ctx — extra positional
            // args could collide with their numeric/string parameters.
            if (slot === undefined) {
              return (...args: unknown[]) => fn(prng, ...args);
            }

            // Bucket 2 (person.firstName / middleName / fullName / prefix):
            // the second arg is ambiguous (Gender string OR GeneratorContext).
            // Only inject boundCtx when the caller passes NO args — otherwise
            // the user's first arg (Gender string or explicit ctx) wins.
            // The Gender-string-without-locale residual is documented and
            // deferred to B36 per spec.
            if (slot === "no-args-only") {
              return (...args: unknown[]) =>
                args.length === 0 ? fn(prng, boundCtx) : fn(prng, ...args);
            }

            // Bucket 1 / Bucket 3 with numeric slot: inject boundCtx at the
            // declared ctx-slot index if the caller did not supply one.
            // `slot` is the helper's 1-indexed signature position counting
            // prng as position 0 (e.g. noun(prng, ctx)→1; words(prng, count, ctx)→2;
            // price(prng, min, max, ctx)→3). Within the user-facing `args`
            // array (prng already bound, stripped), the ctx therefore lives
            // at index `slot - 1`.
            const ctxArgIdx = slot - 1;
            return (...args: unknown[]) => {
              if (args[ctxArgIdx] === undefined) {
                const padded: unknown[] = [...args];
                while (padded.length < ctxArgIdx) padded.push(undefined);
                padded[ctxArgIdx] = boundCtx;
                return fn(prng, ...padded);
              }
              return fn(prng, ...args);
            };
          },
        });

        boundCache[ns] = boundNs;
        return boundNs;
      },
    });
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
    const rel = reg.relations[relName];
    if (!rel) {
      throw new Error(
        `Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`,
      );
    }
    const relSchema = rel.schema;
    const where = rel.where;
    const isSelfRef = relSchema === reg.schema;

    const cacheKey = `${recordId}:${relName}`;
    let items = this.relationPools.get(cacheKey);

    if (!items) {
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
          return undefined as T;
        }
        const provisioned = this.ensurePrimaryRecord(relSchema);
        // B10-R4: when the outer call opted out of storage, the auto-provisioned
        // record was NOT written to the registry. Use the in-memory value
        // directly so the matcher still sees a related instance.
        if (!this.effectiveStore && provisioned !== undefined) {
          items = [provisioned];
        }
      }
      if (!items) {
        items = [...this.registry.all(relSchema)];
      }
      // B11-R3 / B11-R7: apply `where` once, here, when building the snapshot.
      // Filtering before caching means subsequent cache hits do not re-evaluate
      // the predicate (D9 — cache neutrality).
      if (where) {
        items = items.filter((it) => where(it));
      }
      // B11-R6: empty filtered pool throws for non-self-referential relations.
      // The throw happens before the PRNG fork so no PRNG state is consumed.
      if (where && items.length === 0 && !isSelfRef) {
        throw new Error(
          `No related '${relName}' matches the \`where\` predicate. ` +
            `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`,
        );
      }
      this.relationPools.set(cacheKey, items);
    }

    if (items.length === 0) return undefined as T;

    // Derive a stable per-relation PRNG so all fields in one record pick the same related entity.
    const relPrng = recordPrng.fork(`rel:${relName}`);
    const pickedIdx = relPrng.int(0, items.length - 1);
    return items[pickedIdx]! as T;
  }

  private resolveRelatedMany<T = unknown>(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
    count: number,
  ): T[] {
    const rel = reg.relations[relName];
    if (!rel) {
      throw new Error(
        `Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`,
      );
    }
    const relSchema = rel.schema;
    const where = rel.where;
    const isSelfRef = relSchema === reg.schema;

    const cacheKey = `${recordId}:${relName}:many`;
    let items = this.relationPools.get(cacheKey);

    if (!items) {
      // Auto-provision the shortfall until at least `count` records exist —
      // except for self-referential relations, which must not be provisioned
      // (that would recurse forever; see resolveRelated's self-reference guard).
      // Under `where`, auto-provision cannot guarantee the predicate is
      // satisfied (B11-R6) — we do not attempt to coax matchers into
      // producing predicate-satisfying records; if the filtered pool falls
      // short, we throw below.
      if (!isSelfRef && !where) {
        const relReg = this.findPrimaryRegs(relSchema)[0] ?? null;
        if (!this.effectiveStore) {
          // B10-R4: under `store: false`, the registry is not written; collect
          // provisioned records directly into the pool so the matcher still
          // sees them.
          const pool: unknown[] = [...this.registry.all(relSchema)];
          while (pool.length < count) {
            const provisioned = this.generateAndStorePrimary(relSchema, relReg);
            pool.push(provisioned);
          }
          items = pool;
        } else {
          while (this.registry.count(relSchema) < count) {
            this.generateAndStorePrimary(relSchema, relReg);
          }
        }
      }
      if (!items) {
        items = [...this.registry.all(relSchema)];
      }
      // B11-R4 / B11-R7: apply `where` once when building the snapshot.
      if (where) {
        items = items.filter((it) => where(it));
      }
      // B11-R6: throw when the filtered pool is smaller than the requested
      // count for non-self-referential relations.
      if (where && items.length < count && !isSelfRef) {
        throw new Error(
          `No related '${relName}' matches the \`where\` predicate ` +
            `(requested ${count}, available ${items.length}). ` +
            `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`,
        );
      }
      this.relationPools.set(cacheKey, items);
    }

    // Derive a stable per-relation PRNG, distinct from single `related`'s fork,
    // so the picks are deterministic and record-scoped. prng.sample clamps
    // `count` into [0, items.length] and yields distinct, ordered records.
    const relPrng = recordPrng.fork(`rel-many:${relName}`);
    return relPrng.sample(items, count) as T[];
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

    let current = schema;
    let d = def(current);

    while (d.type === "lazy") {
      let resolved = this.lazyCache.get(current);
      if (!resolved) {
        resolved = d.getter!();
        this.lazyCache.set(current, resolved);
      }
      current = resolved;
      d = def(current);
    }

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
      const fieldCtx = this.makeFieldCtx(
        reg,
        source,
        recordPrng,
        fieldPrng,
        fieldPath,
        recordId,
        result,
      );

      // 0. Overrides (Eager)
      // If an override is provided for this key, use it.
      // If it's an object, we still proceed to generateObjectFields below to handle nested overrides.
      const fieldOverride = overrides?.[key];
      if (
        fieldOverride !== undefined &&
        (typeof fieldOverride !== "object" ||
          fieldOverride === null ||
          Array.isArray(fieldOverride))
      ) {
        result[key] = fieldOverride;
        continue;
      }

      // 1. Matcher
      const matcher = reg.matchers[key];
      if (matcher) {
        // Object overrides deep-merge on top of the matcher's value; step 0
        // already handled primitive/null/array overrides eagerly.
        const matched = matcher(fieldCtx);
        result[key] = fieldOverride !== undefined ? deepMerge(matched, fieldOverride) : matched;
        continue;
      }

      // 2. Per-schema key map
      const keyMapFn =
        this.schemaKeyMaps.get(schema)?.[key] ?? this.schemaKeyMaps.get(current)?.[key];
      if (keyMapFn !== undefined) {
        const mapped = keyMapFn(fieldCtx);
        result[key] = fieldOverride !== undefined ? deepMerge(mapped, fieldOverride) : mapped;
        continue;
      }

      // 3. Unwrap optional/nullable/default — roll for absence probability
      let innerSchema = fieldSchema as ZodTypeAny;
      let fd = def(innerSchema);
      let skip = false;
      let fallbackValue: unknown | undefined = undefined;
      let hasFallback = false;

      while (fd.type === "optional" || fd.type === "nullable" || fd.type === "default") {
        const isAbsent = fieldCtx.prng.random() < (this.options.optionalProbability ?? 0.2);

        if (isAbsent && fieldOverride === undefined) {
          if (fd.type === "default") {
            result[key] =
              typeof fd.defaultValue === "function" ? fd.defaultValue() : fd.defaultValue;
          } else if (fd.type === "optional") {
            result[key] = hasFallback ? fallbackValue : undefined;
          } else if (fd.type === "nullable") {
            result[key] = null;
          }
          skip = true;
          break;
        }

        if (fd.type === "default") {
          fallbackValue =
            typeof fd.defaultValue === "function" ? fd.defaultValue() : fd.defaultValue;
          hasFallback = true;
        }

        if (!fd.innerType) break;
        innerSchema = fd.innerType;
        fd = def(innerSchema);
      }
      if (skip) continue;

      // 4. Custom world-level key generator
      const customGen = this.customKeyGenerators.get(key.toLowerCase());
      if (customGen !== undefined) {
        const val = applyModifiers(customGen(innerSchema, fieldCtx), innerSchema);
        result[key] = fieldOverride !== undefined ? deepMerge(val, fieldOverride) : val;
        continue;
      }

      // 5. Key-based heuristic generator
      const keyResult = generateFromKey(key, innerSchema, fieldCtx);
      if (keyResult !== undefined) {
        result[key] =
          fieldOverride !== undefined ? fieldOverride : applyModifiers(keyResult, innerSchema);
        continue;
      }

      // 6. Schema-based generator
      const innerUnwrapped = unwrap(innerSchema);
      const innerDef = def(innerUnwrapped);
      const isObjectLike = innerDef.type === "object" || innerDef.type === "lazy";

      if (isObjectLike) {
        result[key] = fieldCtx.generate(innerSchema, { overrides: fieldOverride });
      } else {
        result[key] =
          fieldOverride !== undefined ? fieldOverride : generateFromSchema(innerSchema, fieldCtx);
      }
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
    const derivedRegs = this.findDerivedRegs(innerSchema);
    const primaryRegs = this.findPrimaryRegs(innerSchema);

    // -------------------------------------------------------------------
    // Derived mode: one output per source record
    // -------------------------------------------------------------------
    if (derivedRegs.length > 0) {
      // Collect all (source, reg, sourceIndex) pairs from existing sources
      type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };
      const pairs: SourcePair[] = [];

      for (const reg of derivedRegs) {
        const sources = this.registry.all(reg.from!);
        for (let i = 0; i < sources.length; i++) {
          pairs.push({ source: sources[i], reg, sourceIndex: i });
        }
      }

      // Auto-provision more sources if min constraint requires it
      const minRequired = resolveMinRequired(arraySchema, defMin);
      while (pairs.length < minRequired) {
        const regIdx = pairs.length % derivedRegs.length;
        const reg = derivedRegs[regIdx]!;
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
    if (primaryRegs.length > 0) {
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

      const reg = primaryRegs[0]!;
      const existingCount = this.registry.count(innerSchema);

      const minRequired = resolveMinRequired(arraySchema, defMin);
      const maxAllowed = resolveMaxAllowed(arraySchema, defMax);
      const target = Math.max(
        existingCount,
        genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)),
      );

      while (this.registry.count(innerSchema) < target) {
        this.generateAndStorePrimary(innerSchema, reg);
      }

      return this.registry.all(innerSchema);
    }

    // -------------------------------------------------------------------
    // Ad-hoc: no registration — pure schema-based generation
    // -------------------------------------------------------------------
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

  private generateSingleItem(schema: ZodTypeAny, options?: GenerateOptions<unknown>): unknown {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (this.options.recursionLimit ?? 5)) return null;

    // B39 — only the derived-without-source pair picker (below, at the
    // `pairs[idx]` site) still reads this counter. The three former
    // PRNG-fork-key consumers (ad-hoc, array, outer-wrap) moved to
    // `schemaCallCounts` via `nextSchemaSlot`.
    this.derivedPairCounter++;

    let current = schema;
    let d = def(current);

    while (d.type === "lazy") {
      let resolved = this.lazyCache.get(current);
      if (!resolved) {
        resolved = d.getter!();
        this.lazyCache.set(current, resolved);
      }
      current = resolved;
      d = def(current);
    }
    const targetSchema = current;

    const derivedRegs =
      this.findDerivedRegs(schema).length > 0
        ? this.findDerivedRegs(schema)
        : this.findDerivedRegs(targetSchema);
    const primaryRegs =
      this.findPrimaryRegs(schema).length > 0
        ? this.findPrimaryRegs(schema)
        : this.findPrimaryRegs(targetSchema);

    let result: unknown;
    let transformApplied = false;
    const sourceOverride = (options as any)?.source;

    if (sourceOverride !== undefined) {
      const reg = derivedRegs[0] ?? { ...EMPTY_REG, schema };
      const regWithKey = reg as SchemaReg;
      // B8: derive the per-pair upsert identity. `sourceKey` is the declared
      // field name; if absent, identity falls back to reference equality on
      // the source object itself.
      const sourceKey = regWithKey.sourceKey;
      const identity =
        sourceKey !== null && sourceKey !== undefined
          ? (sourceOverride as Record<string, unknown>)[sourceKey]
          : sourceOverride;

      const isUnique = options?.unique !== false;
      const canUseUpsert = isUnique && this.effectiveStore;

      if (canUseUpsert) {
        // B8-R1 / B8-R9: short-circuit on a hit — return the cached record
        // by reference, do not run the generation pipeline, do not consume
        // PRNG, do not advance the generation counter (we unwind it below).
        const existing = this.derivedUpsert.get(schema)?.get(identity);
        if (existing !== undefined) {
          // D9 / B8-R9: an upsert hit must leave no observable per-world
          // generation state behind. Roll back the `derivedPairCounter`
          // increment from the top of this method so the next derived-without-
          // source pair pick sees the same index it would have if this call
          // had not happened. The B39 per-schema slot maps (`schemaCallCounts`)
          // were not touched in this branch (the ad-hoc Site 1 below was
          // never reached), so no slot rollback is needed.
          this.derivedPairCounter--;
          return existing;
        }
      }

      // `generateDerivedRecord` already applies `options.overrides` (via
      // `generateObjectFields`'s per-field deep-merge) AND `options.transform`
      // — see B14 (D8). Trust its return value here; do NOT re-apply
      // overrides or transform in this branch (would double-apply for any
      // non-idempotent transform).
      result = this.generateDerivedRecord(
        schema,
        regWithKey,
        sourceOverride,
        0,
        options,
      );

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
    } else if (derivedRegs.length > 0) {
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
      result = this.generateDerivedRecord(schema, reg, source, sourceIndex, options);
      transformApplied = true;
    } else if (primaryRegs.length > 0) {
      result = this.generateAndStorePrimary(schema, primaryRegs[0]!, options);
      transformApplied = true;
    } else {
      // Ad-hoc — B39 Site 1: key the ad-hoc PRNG on the outer `schema`
      // reference (the one the caller invoked `generate(...)` with), NOT on
      // the lazy-resolved `targetSchema`. The outer reference is stable
      // across `z.lazy(...)` re-resolutions, matching the spec's identity model.
      const { id: adhocId, slot: adhocSlot } = this.nextSchemaSlot(schema);
      const recordId = `adhoc:${adhocId}:${adhocSlot}`;
      const adHocPrng = this.prng.fork(recordId);
      const fieldPath = options?.fieldPath ?? recordId;
      if (def(targetSchema).type === "object") {
        result = this.generateObjectFields(
          targetSchema,
          EMPTY_REG,
          undefined,
          adHocPrng,
          recordId,
          fieldPath,
          options?.overrides as Record<string, unknown>,
        );
      } else {
        result = generateFromSchema(
          targetSchema,
          this.makeFieldCtx(EMPTY_REG, undefined, adHocPrng, adHocPrng, fieldPath, recordId),
        );
      }
    }

    if (options?.overrides) result = deepMerge(result, options.overrides);
    if (options?.transform && !transformApplied) {
      result = options.transform(result as input<ZodTypeAny>);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createWorld(options?: WorldOptions): World {
  return new WorldImpl(options ?? {});
}
