/**
 * @module world/engine
 * The `WorldImpl` class — the central context for one data-generation session.
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
 * The executable contract is the `PIPELINE` list in `src/pipeline.ts`. For every
 * field of a registered schema, the engine walks these seven steps in order; the
 * first step that produces a value wins.
 *
 * 0. **Eager overrides** — `options.overrides` primitive/array entries land in
 *    `ctx.current` so sibling matchers can read them via `ctx.current.<sibling>`.
 * 1. **Matchers** — user functions from `withSchema({ matchers })`. Explicit
 *    per-field functions; first to win.
 * 2. **Per-schema key map** — entries from `withKeyMap({ ... })` matched on the
 *    field name.
 * 3. **Unwrap optional** — strip `optional`/`nullable`/`default` and roll absent
 *    per layer; sets `ctx.inner` for downstream steps. Internal — does not
 *    produce a final value on its own.
 * 4. **World-level custom generators** — entries from `withGenerators({ ... })`
 *    matched on the field name.
 * 5. **Key-based heuristics** — built-in `DEFAULT_KEY_MAP` exact-key +
 *    `DEFAULT_KEY_PATTERNS` regex matches (`email` → realistic email,
 *    `firstName` → first name, `createdAt` → date).
 * 6. **Schema-based fallback** — Zod type introspection (`z.enum([...])` →
 *    random member, `z.number().int().min(1).max(100)` → integer in range,
 *    etc.). Always resolves.
 *
 * After the pipeline returns, two wrapping passes finish the record:
 *
 * - **Override deep-merge** — `options.overrides` is deep-merged onto the
 *   pipeline's value (covers nested-object slices step 0 didn't eagerly
 *   consume; B12 contract).
 * - **Transform** — `options.transform` is called on the merged value.
 *
 * ## File layout (B28)
 *
 * This module owns the `WorldImpl` class, its constructor, its public methods,
 * and the B39 module-global stable schema identity machinery. Pure helpers
 * are split out:
 *   - `./registration.js` — `SchemaReg`, `EMPTY_REG`, `normalizeRelationEntry`,
 *     `findPrimaryRegs`, `findDerivedRegs`, `resolveMode`.
 *   - `./derived.js`       — derived-upsert map access helpers (B8).
 *   - `./relations.js`     — relation cache-key / fork-key / error-message helpers,
 *                             and the `RelationResolver` collaborator (B62) that owns
 *                             `resolveRelated` / `resolveRelatedMany` / `resolveRelationPool` /
 *                             `ensurePrimaryRecord`. `WorldImpl` calls via `this.relations.X(...)`.
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
} from "../types.js";
import { SchemaRegistry } from "../registry.js";
import { createPrng, fieldSeed } from "../prng.js";
import { generateFromSchema } from "../generators/schema/index.js";
import {
  def,
  checks,
  unwrap,
  resolveLazyChain,
  stripOuterOptionalNullable,
} from "../generators/schema/zod-def.js";
import { deepMerge, deepEqual } from "../utils/merge.js";
import { defaultLocale } from "../default-locale.js";
import type { LocaleData } from "@zod4-mock/locale-core";
import { explainSchema } from "../explain.js";
import { PIPELINE, walkPipeline } from "../pipeline.js";
import {
  EMPTY_REG,
  findDerivedRegs as findDerivedRegsPure,
  findPrimaryRegs as findPrimaryRegsPure,
  normalizeRelationEntry,
  resolveMode as resolveModePure,
  type NormalizedRelation,
  type SchemaMode,
  type SchemaReg,
} from "./registration.js";
import {
  computeSourceIdentity,
  getDerivedUpsert,
  setDerivedUpsert,
  type DerivedUpsertMap,
} from "./derived.js";
import { RelationResolver } from "./relations.js";
import { buildLazyGen, type FieldState } from "./bind-generators.js";

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
// B28: this WeakMap MUST remain a single module-level instance — splitting
// the engine across files MUST NOT accidentally duplicate it. The map lives
// here (engine.ts) and is consulted only from `WorldImpl.nextSchemaSlot`.
//
// ---------------------------------------------------------------------------

const globalSchemaIds: WeakMap<ZodTypeAny, number> = new WeakMap();
let nextGlobalSchemaId = 0;

// ---------------------------------------------------------------------------
// B97-R15 — empty-map singletons shared by every world.
//
// Read sites that need a `ReadonlyMap` view (e.g. the per-record pipeline
// ctx) and don't need to mutate it use these sentinels instead of forcing
// a per-world allocation of an empty `Map`. The sentinels are frozen at
// module load; the pipeline never writes to them.
// ---------------------------------------------------------------------------

// B97-R15: empty-map singletons shared across worlds. Read sites
// (the per-record pipeline ctx, the `explain()` helper) consult these
// when the world's per-instance map is still `null`, avoiding a
// per-world allocation of an empty Map. Typed as mutable `Map<...>` to
// match the caller interface contracts; by convention these are
// read-only — never `.set(...)` into them.
const EMPTY_CUSTOM_KEY_GENERATORS: Map<string, KeyGenerator> = new Map();
const EMPTY_SCHEMA_KEY_MAPS: Map<
  ZodTypeAny,
  Record<string, (ctx: GeneratorContext) => unknown>
> = new Map();

function getSchemaId(schema: ZodTypeAny): number {
  let id = globalSchemaIds.get(schema);
  if (id === undefined) {
    id = nextGlobalSchemaId++;
    globalSchemaIds.set(schema, id);
  }
  return id;
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
// Derived array source pair
// ---------------------------------------------------------------------------

/**
 * One source record paired with the derived `SchemaReg` it feeds and the
 * index it occupies in its source registry. Built by `collectSourcePairs`
 * and consumed by both `generateArrayDerived` (one derived record per pair,
 * up to the cap) and `generateDerivedAutoSource` (single-item round-robin
 * pick by `derivedPairCounter`).
 */
type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };

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

  /**
   * B97-R15 — five mutable maps lazily allocated on first write. A
   * freshly-constructed world that never calls `withSchema` / `withKeyMap`
   * / `withGenerators` and never resolves a relation leaves all five at
   * `null`. Reads check via `?.get(...)`; writes route through the
   * `ensureXxx()` helpers below.
   */
  private customKeyGenerators: Map<string, KeyGenerator> | null = null;
  private schemaKeyMaps: Map<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > | null = null;
  private relationPools: Map<string, unknown[]> | null = null;
  private pendingCounts: Map<ZodTypeAny, number> | null = null;
  /**
   * B8 — per-pair upsert map for derived schemas registered with `from:`.
   * Outer key: derived schema reference. Inner key: source identity (the
   * source reference itself, or `source[sourceKey]` when declared). The
   * stored value is the post-transform derived record — the same reference
   * that lives in the registry (D8 — see `wiki/decisions.md`).
   *
   * B97-R15 — lazy: starts `null`; first write goes through
   * `ensureDerivedUpsert()`.
   */
  private derivedUpsert: DerivedUpsertMap | null = null;
  private lazyCache = new WeakMap<ZodTypeAny, ZodTypeAny>();
  /**
   * Effective storage mode for the current outer `generate` call. When `false`,
   * `generateAndStorePrimary` and `generateDerivedRecord` skip their
   * `registry.store` side-effect. Propagates through nested recursion; scoped
   * to the outer call via try/finally in `WorldImpl.generate`.
   */
  private effectiveStore = true;

  /**
   * B65 — per-call locale, set when the caller passes `{ locale }` to
   * `world.generate(...)`. Read by {@link makeFieldCtx} so matcher closures
   * see the per-call locale on `ctx.locale` (and therefore through
   * `ctx.gen.*` calls). When `undefined`, `makeFieldCtx` falls back to the
   * world-construction `options.locale`. Push/pop in
   * {@link withEffectiveLocale} mirrors {@link withEffectiveStore}.
   */
  private effectiveLocale: LocaleData | undefined = undefined;

  /**
   * Per-call `defaultArrayLength`, set when the caller passes
   * `{ defaultArrayLength }` to `world.generate(...)`. Propagates through
   * nested recursion (object fields, nested arrays) via the
   * `withEffectiveDefaultArrayLength` push/pop scope so inner
   * `generateArray` calls honour the outer call's intent. When `undefined`,
   * `generateArray` falls back to `this.options.defaultArrayLength ?? [1, 5]`.
   */
  private effectiveDefaultArrayLength: readonly [number, number] | undefined = undefined;

  /**
   * B55-R6 — per-call unique-mode flag, set when the caller passes
   * `{ unique: true }` to `world.generate(...)`. Read by {@link makeFieldCtx}
   * so the field-bound `ctx.prng.pickZipf` substitutes `s = 0` for the
   * duration of the call (uniqueness wins over realism — per B51 Q-9).
   * Push/pop in {@link withEffectiveUniqueMode} mirrors {@link withEffectiveLocale}.
   */
  private effectiveUniqueMode = false;

  /**
   * B62 — relation-resolution collaborator. Owns `relationPools` (shared with
   * this `WorldImpl` via the deps surface) and hosts `resolveRelated` /
   * `resolveRelatedMany` / `resolveRelationPool` / `ensurePrimaryRecord`. The
   * `WorldImpl` remains the public face; this field is module-private.
   */
  private readonly relations: RelationResolver;

  /**
   * B97 — mutable per-`generate()` holder threaded through the lazy generator
   * binder (see `./bind-generators.ts`). Allocated lazily at the top of the
   * outer `generate()` entry path; the field loop mutates `state.prng` /
   * `state.ctx` in place so bound closures observe per-field state at call
   * time without rebinding.
   *
   * Lifetime: scoped to the outer `generate()` call. Reused across nested
   * `generate()` recursion (the holder is overwritten each `makeFieldCtx`
   * call). When the call returns, the holder remains live until the next
   * outer call replaces it — that's fine because every `makeFieldCtx` call
   * rewrites both fields before passing the holder back through `ctx.gen`.
   */
  private fieldState: FieldState | null = null;
  private boundGen: BoundGenerators | null = null;

  constructor(private readonly options: WorldOptions = {}) {
    this.rootSeed = (options || {}).seed ?? Math.floor(Math.random() * 0xffffffff);
    this.prng = createPrng(this.rootSeed);
    this.registry = new SchemaRegistry(this.prng.fork("registry"));
    // B97-R15: only allocate `customKeyGenerators` if construction options
    // supply any. The empty-no-options shape leaves it at `null`.
    if (options.generators) {
      const entries = Object.entries(options.generators);
      if (entries.length > 0) {
        const map = this.ensureCustomKeyGenerators();
        for (const [k, fn] of entries) {
          map.set(k.toLowerCase(), fn);
        }
      }
    }
    this.relations = new RelationResolver({
      registry: this.registry,
      // B97-R15: pass a callback so the relation pool map is allocated only
      // when the resolver actually reads/writes it (i.e. the first relation
      // resolution); a world with no relations never allocates it.
      getRelationPools: () => this.ensureRelationPools(),
      findPrimaryReg: (schema) => this.findPrimaryRegs(schema)[0] ?? null,
      generateAndStorePrimary: (schema, reg) => this.generateAndStorePrimary(schema, reg),
      isStoreActive: () => this.effectiveStore,
    });
  }

  // -------------------------------------------------------------------------
  // B97-R15 — lazy map ensure helpers
  //
  // Each `ensureXxx()` returns the corresponding map, allocating it on first
  // call. Used at every write site; read sites prefer `?.get(...)` so they
  // do not trigger allocation when the map is still `null`.
  // -------------------------------------------------------------------------

  private ensureCustomKeyGenerators(): Map<string, KeyGenerator> {
    if (this.customKeyGenerators === null) {
      this.customKeyGenerators = new Map();
    }
    return this.customKeyGenerators;
  }

  private ensureSchemaKeyMaps(): Map<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > {
    if (this.schemaKeyMaps === null) {
      this.schemaKeyMaps = new Map();
    }
    return this.schemaKeyMaps;
  }

  private ensureRelationPools(): Map<string, unknown[]> {
    if (this.relationPools === null) {
      this.relationPools = new Map();
    }
    return this.relationPools;
  }

  private ensurePendingCounts(): Map<ZodTypeAny, number> {
    if (this.pendingCounts === null) {
      this.pendingCounts = new Map();
    }
    return this.pendingCounts;
  }

  private ensureDerivedUpsert(): DerivedUpsertMap {
    if (this.derivedUpsert === null) {
      this.derivedUpsert = new Map();
    }
    return this.derivedUpsert;
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
  private nextSchemaSlot(schema: ZodTypeAny, commit: boolean = true): { id: number; slot: number } {
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
    // B47: a schema reference MAY be registered only as one of primary OR
    // derived on a given world. Mixing the two polarities throws at
    // `withSchema` time, before the new `SchemaReg` is appended — so the
    // failed call leaves `this.schemaRegs` unchanged.
    const incomingDerived = opts?.from !== undefined;
    if (incomingDerived && this.findPrimaryRegs(schema).length > 0) {
      throw new Error(
        "withSchema: schema is already registered as primary and cannot also be registered as derived (with `from:`). Use a distinct schema reference for the other role.",
      );
    }
    if (!incomingDerived && this.findDerivedRegs(schema).length > 0) {
      throw new Error(
        "withSchema: schema is already registered as derived (with `from:`) and cannot also be registered as primary. Use a distinct schema reference for the other role.",
      );
    }

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
    const target = this.ensureCustomKeyGenerators();
    for (const [k, fn] of Object.entries(map)) {
      target.set(k.toLowerCase(), fn);
    }
    return this;
  }

  withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this {
    const target = this.ensureSchemaKeyMaps();
    const existing = target.get(schema) ?? {};
    target.set(schema, {
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

    // B52-R6: the historical primary-first pre-check is dead code post-D12
    // (`withSchema` throws on dual primary/derived registration, so the
    // inversion-observable configuration cannot exist). Dispatch directly via
    // `resolveMode` — matching how `generate`, `generateArray`, and `get`
    // dispatch.
    const mode = this.resolveMode(schema);
    switch (mode.kind) {
      case "derived": {
        const reg = mode.regs[0]!;
        const fromSchema = reg.from!;
        const sources = this.registry.all(fromSchema);
        // B52-R5: auto-provision additional sources when sources.length < count,
        // mirroring `generateArray`'s derived auto-provision. populate's
        // always-write contract (B10-R6) writes the auto-provisioned sources
        // to the source registry via `generateAndStorePrimary`.
        const fromReg = this.findPrimaryRegs(fromSchema)[0] ?? null;
        for (let i = 0; i < count; i++) {
          let source: unknown;
          if (i < sources.length) {
            source = sources[i];
          } else {
            source = this.generateAndStorePrimary(fromSchema, fromReg);
          }
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          const result = this.generateDerivedRecord(schema, reg, source, i, opts);
          this.registry.store(schema, result as input<TSchema>);
        }
        break;
      }
      case "primary": {
        // B52-R6: the new primary arm replaces the removed pre-check;
        // observable behaviour identical.
        for (let i = 0; i < count; i++) {
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          this.generateAndStorePrimary(schema, mode.reg, opts);
        }
        break;
      }
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
      const { store: _ignored, ...rest } = (factoryReturn ?? {}) as GenerateOptions<
        z.infer<TDerived>
      > & {
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
    // B97: scope the lazy generator-binder holder to this outer call so a
    // matcher's `ctx.gen.<ns>.<fn>()` always observes the holder set up for
    // its own field, even when the matcher invokes nested `ctx.generate(...)`
    // that allocates its own per-call holder. Save/restore via try/finally.
    return this.withFieldStateScope(() =>
      // B10-R2/R4: scope the effective store mode to this outer call. When the
      // caller passes `store: false`, this mode propagates through nested
      // recursion (generateObjectFields / generateArray / ctx.generate which
      // re-enters this method); restore the previous value on exit so a separate
      // top-level call is unaffected. B10-R5: explicit `store: true` overrides
      // an inherited `store: false` (used by `world.get` to force storage on its
      // create-path delegate call).
      this.withEffectiveLocale(options?.locale, () =>
        this.withEffectiveUniqueMode(options?.unique, () =>
          this.withEffectiveDefaultArrayLength(options?.defaultArrayLength, () =>
          this.withEffectiveStore(options?.store, () => {
            const stripped = stripOuterOptionalNullable(schema);
            let current: ZodTypeAny = stripped.inner;
            const outerWrappers = stripped.wrappers;

            current = resolveLazyChain(current, this.lazyCache);
            const d = def(current);

            if (d.type === "array") {
              if (outerWrappers.length > 0) {
                // B39 — site 3: outer-wrapper optional/nullable roll. Key on the
                // outer `schema` reference (the `.optional()` wrapper) so the Nth
                // call to the same `.optional()` schema reuses the same fork key
                // regardless of intervening `generate(Y)` calls.
                const { id, slot } = this.nextSchemaSlot(schema);
                const prng = this.prng.fork(`wrap:${id}:${slot}`);
                const optProb = options?.optionalProbability ?? this.options.optionalProbability ?? 0.2;
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
          }),
          ),
        ),
      ),
    );
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
      this.schemaKeyMaps?.get(schema) ??
      (this.schemaKeyMaps?.get(unwrap(schema)) as
        | Record<string, (ctx: GeneratorContext) => unknown>
        | undefined) ??
      {};

    return explainSchema(schema, {
      matchers: reg?.matchers ?? {},
      schemaKeyMap,
      // B97-R15: explain reads the map for lookups; an empty Map is the
      // null-equivalent. Avoid allocation on the read path.
      customKeyGenerators: this.customKeyGenerators ?? EMPTY_CUSTOM_KEY_GENERATORS,
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
  //
  // Thin wrappers over the pure helpers in `./registration.js` — they keep
  // the call sites in this file readable and let `WorldImpl`'s private
  // `schemaRegs` array stay encapsulated.
  // -------------------------------------------------------------------------

  private findPrimaryRegs(schema: ZodTypeAny): SchemaReg[] {
    return findPrimaryRegsPure(this.schemaRegs, schema);
  }

  private findDerivedRegs(schema: ZodTypeAny): SchemaReg[] {
    return findDerivedRegsPure(this.schemaRegs, schema);
  }

  // -------------------------------------------------------------------------
  // Private: schema-mode resolution (B25)
  //
  // Tagged union over the three registration modes. Replaces the
  // `findDerivedRegs(...).length > 0 ? ... : findPrimaryRegs(...).length > 0
  // ? ... : ad-hoc` cascade that previously appeared in `generateSingleItem`,
  // `generateArray`, `populate`, and `get`.
  //
  // Derived-first precedence is uniform across all four dispatchers
  // post-D12/B52 — `withSchema` forbids dual primary+derived registration at
  // registration time (so the inversion-observable config cannot exist) and
  // `populate`'s former primary-first pre-check was removed. Operates on
  // whatever schema reference it is given — callers handle the two-level
  // (`schema` then `targetSchema`) fallback themselves where they need it.
  // -------------------------------------------------------------------------

  private resolveMode(schema: ZodTypeAny): SchemaMode {
    return resolveModePure(this.schemaRegs, schema);
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

  /**
   * B65 — push/pop {@link effectiveLocale} for the duration of `fn`. When
   * `value` is `undefined` no push/pop happens (the call inherits the ambient
   * locale); when `value` is provided the per-call locale is set for the
   * duration of `fn` and restored in `finally`. Mirrors
   * {@link withEffectiveStore}.
   */
  private withEffectiveLocale<R>(value: LocaleData | undefined, fn: () => R): R {
    if (value === undefined) return fn();
    const previous = this.effectiveLocale;
    this.effectiveLocale = value;
    try {
      return fn();
    } finally {
      this.effectiveLocale = previous;
    }
  }

  private withEffectiveDefaultArrayLength<R>(
    value: readonly [number, number] | undefined,
    fn: () => R,
  ): R {
    if (value === undefined) return fn();
    const previous = this.effectiveDefaultArrayLength;
    this.effectiveDefaultArrayLength = value;
    try {
      return fn();
    } finally {
      this.effectiveDefaultArrayLength = previous;
    }
  }

  /**
   * B55-R6 — push/pop {@link effectiveUniqueMode} for the duration of `fn`.
   * Only `value === true` activates the mode (the default is false, and an
   * explicit `false` is a no-op pass-through — matching B65's
   * "undefined ⇒ inherit" pattern but specialised for the boolean opt-in).
   */
  private withEffectiveUniqueMode<R>(value: boolean | undefined, fn: () => R): R {
    if (value !== true) return fn();
    const previous = this.effectiveUniqueMode;
    this.effectiveUniqueMode = true;
    try {
      return fn();
    } finally {
      this.effectiveUniqueMode = previous;
    }
  }

  /**
   * B97 — push/pop the lazy generator-binder holder for the duration of `fn`.
   *
   * The holder is allocated lazily by {@link ensureFieldState} on first
   * `makeFieldCtx` call within the outer `generate()`. Nested `ctx.generate`
   * calls would otherwise mutate the same holder and break a captured outer
   * `ctx.gen` reference; saving/restoring the holder + `boundGen` pair here
   * ensures each outer call gets its own pair while still amortising binding
   * across all fields of the same call.
   *
   * Also wires the test-only `__setCurrentWorld` seam so the
   * `bind-generators-lazy.test.ts` per-world bind counter can attribute
   * materialisations to this `WorldImpl` instance.
   */
  private withFieldStateScope<R>(fn: () => R): R {
    const previousState = this.fieldState;
    const previousGen = this.boundGen;
    this.fieldState = null;
    this.boundGen = null;
    try {
      return fn();
    } finally {
      this.fieldState = previousState;
      this.boundGen = previousGen;
    }
  }

  // -------------------------------------------------------------------------
  // Private: generators binding
  // -------------------------------------------------------------------------

  /**
   * B97 — lazy generator binding via mutable holder.
   *
   * Returns the shared `BoundGenerators` for the current outer `generate()`
   * call, allocating the `FieldState` + `buildLazyGen` pair on first
   * invocation and reusing them on every subsequent `makeFieldCtx` within
   * the same call. Each namespace is a property-getter on the returned
   * object that materialises its closure set on first touch and caches the
   * result — see `./bind-generators.ts` for the binder.
   *
   * The bound closures read `state.prng` / `state.ctx` at call time, so the
   * field loop only needs to mutate the holder's two fields per iteration
   * instead of re-binding 14 namespaces × ~10 helpers per field.
   *
   * B40's ctx-forwarding contract is preserved byte-identically (see
   * `CTX_SLOTS` in `./bind-generators.ts`).
   */
  private ensureFieldState(prng: Prng, ctx: GeneratorContext): FieldState {
    let state = this.fieldState;
    if (state === null) {
      state = { prng, ctx, world: this };
      this.fieldState = state;
      this.boundGen = buildLazyGen(state);
    } else {
      state.prng = prng;
      state.ctx = ctx;
    }
    return state;
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

  /**
   * Build a fresh per-field `GeneratorContext` literal. R13's
   * `makeRecordCtx` + `updateFieldCtx` split was reverted (see spec
   * Context → "R13 was also tried and reverted"): the per-field literal
   * preserves monomorphic shape for V8 inline caching, which dominates the
   * allocation cost on small (no-matcher) workloads.
   *
   * Per-field PRNG (`fieldPrng`) seeds all data generation; `recordPrng`
   * is the stable per-record PRNG used for relation resolution so
   * `ctx.related("owner")` returns the same owner across every field of
   * the record. The lazy-bind holder (`fieldState`) is updated to point
   * at this field's PRNG + ctx so any bound closures `ctx.gen.<ns>.<fn>()`
   * triggers see the current field's state at call time.
   */
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
      this.relations.resolveRelated<T>(
        reg,
        recordPrng,
        recordId,
        relName,
      )) as GeneratorContext["related"];
    related.many = <T = unknown>(relName: string, count: number): T[] =>
      this.relations.resolveRelatedMany<T>(reg, recordPrng, recordId, relName, count);
    // B55-R6 — when the outer `generate` call passes `unique: true`,
    // `effectiveUniqueMode` is true for the duration of the call. Wrap
    // `fieldPrng` so its `pickZipf` substitutes `s = 0` regardless of the
    // configured exponent (uniqueness wins over realism). All other methods
    // delegate verbatim — no PRNG state semantics change. Wrapping at the
    // field boundary covers both the direct `ctx.prng.pickZipf(...)` path
    // and the `ctx.gen.*` namespace (whose generators receive this same
    // wrapped prng through `bindGenerators`).
    const exposedPrng: Prng = this.effectiveUniqueMode
      ? {
          get seed(): number {
            return fieldPrng.seed;
          },
          random: () => fieldPrng.random(),
          int: (min, max) => fieldPrng.int(min, max),
          pick: ((items: readonly unknown[]) =>
            fieldPrng.pick(items as readonly [unknown, ...unknown[]])) as Prng["pick"],
          pickZipf: <T>(items: readonly T[], _s: number): T => fieldPrng.pickZipf(items, 0),
          logUniform: (min, max) => fieldPrng.logUniform(min, max),
          geometric: (p) => fieldPrng.geometric(p),
          shuffle: (items) => fieldPrng.shuffle(items),
          sample: (items, count) => fieldPrng.sample(items, count),
          fork: (key) => fieldPrng.fork(key),
          bytes: (n) => fieldPrng.bytes(n),
        }
      : fieldPrng;

    // Allocate / refresh the lazy-bind holder so `ctx.gen.<ns>.<fn>()`
    // observes this field's prng + ctx at call time. The holder shape is
    // stable across fields; the per-namespace getters in `buildLazyGen`
    // materialise closures only when a matcher actually reads them.
    const state = this.ensureFieldState(exposedPrng, undefined as unknown as GeneratorContext);
    const ctx: GeneratorContext = {
      prng: exposedPrng,
      gen: this.boundGen!,
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
      current: (current ?? {}) as Partial<unknown>,
      // B65: per-call `generate(S, { locale })` wins over the world-level
      // construction option. `withEffectiveLocale` set it in scope; without it,
      // fall back to the world's `options.locale`, then `defaultLocale`.
      locale: this.effectiveLocale ?? this.options.locale ?? defaultLocale,
      defaultArrayLength: this.effectiveDefaultArrayLength ?? this.options.defaultArrayLength ?? [1, 5],
    };
    state.ctx = ctx;
    return ctx;
  }

  // -------------------------------------------------------------------------
  // Private: relation resolution
  //
  // B62 — the four entangled methods (`resolveRelated`, `resolveRelatedMany`,
  // `resolveRelationPool`, `ensurePrimaryRecord`) now live on the
  // `RelationResolver` collaborator in `./relations.js`. Call sites in this
  // file go through `this.relations.X(...)`.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Private: primary record generation
  // -------------------------------------------------------------------------

  private generateAndStorePrimary(
    schema: ZodTypeAny,
    reg: SchemaReg | null,
    options?: GenerateOptions<unknown>,
  ): unknown {
    // B97-R15: pendingCounts is lazily allocated. The first invocation of
    // `generateAndStorePrimary` for any schema triggers allocation. A
    // zero-config `world.generate(schema)` that does not hit the
    // store-on path (ad-hoc / store: false) keeps `pendingCounts === null`.
    const pendingMap = this.ensurePendingCounts();
    const pending = pendingMap.get(schema) ?? 0;
    const recordIndex = this.registry.count(schema) + pending;
    pendingMap.set(schema, pending + 1);

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
      // pendingCounts was allocated at the top of this method via
      // ensurePendingCounts(); it cannot be null here.
      const currentPending = pendingMap.get(schema) ?? 1;
      pendingMap.set(schema, currentPending - 1);
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
      const fieldCtx = this.makeFieldCtx(
        reg,
        source,
        recordPrng,
        fieldPrng,
        fieldPath,
        recordId,
        result,
      );
      result[key] = walkPipeline(PIPELINE, {
        fieldSchema: fs,
        fieldName: key,
        fieldCtx,
        fieldOverride: overrides?.[key],
        reg,
        outerSchema: schema,
        resolvedSchema: current,
        // B97-R15: empty sentinels avoid a per-world Map allocation when
        // neither was wired through `withGenerators` / `withKeyMap`.
        customKeyGenerators: this.customKeyGenerators ?? EMPTY_CUSTOM_KEY_GENERATORS,
        schemaKeyMaps: this.schemaKeyMaps ?? EMPTY_SCHEMA_KEY_MAPS,
        optionalProbability: this.options.optionalProbability ?? 0.2,
        dryRun: false,
        state: { inner: fs },
        explainMeta: null,
      }).value;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Private: array generation
  // -------------------------------------------------------------------------

  /**
   * Thin dispatcher: resolves recursion-depth, the array PRNG fork, and the
   * inner-schema mode, then delegates to one of three per-mode methods. The
   * shared trailing pass ({@link applyArrayTrailingPass}) closes the D14
   * sequence (cap → overrides → transform) by applying `options.transform`
   * uniformly across all three arms — the cap and per-index overrides are
   * already applied AT PRODUCTION TIME inside each per-mode method, where
   * D8 (stored == returned) requires they precede `registry.store`.
   *
   * Mirrors {@link generateSingleItem}'s B24 decomposition: dispatcher + named
   * branch helpers, with the trailing tail in one shared place so any new
   * cross-arm behaviour added per D14 lands once.
   */
  private generateArray(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    options?: GenerateOptions<unknown[]>,
  ): unknown[] {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (options?.recursionLimit ?? this.options.recursionLimit ?? 5)) return [];

    // B39 — site 2: key the array's PRNG on the outer `arraySchema` reference
    // (NOT the inner element schema). Keying on the inner schema would
    // coalesce `z.array(X).min(3)` and `z.array(X).max(5)` into one slot
    // bucket; keying on the outer ZodArray reference preserves their
    // independence.
    const { id: arrayId, slot: arraySlot } = this.nextSchemaSlot(arraySchema);
    const genPrng = this.prng.fork(`array:${arrayId}:${arraySlot}`);

    const [defMin, defMax] = this.effectiveDefaultArrayLength ?? this.options.defaultArrayLength ?? [1, 5];
    const mode = this.resolveMode(innerSchema);

    let result: unknown[];
    switch (mode.kind) {
      case "derived":
        result = this.generateArrayDerived(
          innerSchema,
          arraySchema,
          mode.regs,
          defMin,
          defMax,
          options,
        );
        break;
      case "primary":
        result = this.generateArrayPrimary(
          innerSchema,
          arraySchema,
          mode.reg,
          defMin,
          defMax,
          genPrng,
          options,
        );
        break;
      case "ad-hoc":
        result = this.generateArrayAdHoc(
          innerSchema,
          arraySchema,
          defMin,
          defMax,
          genPrng,
          options,
        );
        break;
    }

    return this.applyArrayTrailingPass(result, options);
  }

  /**
   * Derived arm — one output per source record across all derived `mode.regs`.
   *
   * Preserved contracts:
   *   - Auto-provisions sources via `generateAndStorePrimary` until pair count
   *     reaches `minRequired` (B52-R1 framing).
   *   - B52-R8 / D14: caps at `callerMax ?? defMax` BEFORE production so no
   *     `generateDerivedRecord` runs and no record is stored past the cap
   *     (preserves D8: `registry.count(Derived) === result.length`).
   *   - B52-R4: applies per-index `options.overrides` via post-production
   *     `deepMerge` — matching the existing semantics (the stored record is
   *     the pre-merge value; returned record is post-merge).
   *   - Returns the result PRE-transform; the dispatcher's shared trailing
   *     pass applies `options.transform`.
   */
  private generateArrayDerived(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    defMin: number,
    defMax: number,
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    const pairs = this.collectSourcePairs(derivedRegs);

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

    // B52-R1 / B52-R8: cap at `callerMax ?? defMax` BEFORE production —
    // never call `generateDerivedRecord` for pairs beyond the cap, never
    // store records past the cap (D8: stored = returned). The floor
    // (`minRequired`) wins when it exceeds the cap — mirror the primary
    // arm's `Math.min(min, max), Math.max(min, max)` framing so an
    // impossible `.min(6).max(3)` configuration collapses to a defined
    // length rather than throwing.
    const callerMax = readCallerMaxBound(arraySchema);
    const upper = callerMax ?? defMax;
    const cap = Math.max(minRequired, Math.min(upper, pairs.length));
    const capped = pairs.slice(0, cap);

    let result: unknown[] = capped.map(({ source, reg, sourceIndex }) => {
      const record = this.generateDerivedRecord(innerSchema, reg, source, sourceIndex);
      // D8 — every returned record is also stored, gated on
      // `effectiveStore` so `{ store: false }` suppresses the write.
      if (this.effectiveStore) {
        this.registry.store(innerSchema, record as input<ZodTypeAny>);
      }
      return record;
    });

    // B52-R4: apply per-index overrides on derived path (mirror the ad-hoc
    // arm's post-production `deepMerge`). Transform lives in the shared
    // trailing pass.
    if (options?.overrides) {
      const overrides = options.overrides as unknown[];
      result = result.map((item, i) => {
        const ov = overrides[i];
        return ov !== undefined ? deepMerge(item, ov as Record<string, unknown>) : item;
      });
    }
    return result;
  }

  /**
   * Primary arm — generate N items, store each in the registry, return all.
   *
   * Preserved contracts:
   *   - Target length is `max(existingCount, int(min, max))` so previously
   *     populated records are respected.
   *   - B43 / B52-R2 / D14: honours caller `.max()` / `.length()` on BOTH
   *     store-on and store-off paths; does NOT slice on the library-side
   *     `defMax` fallback.
   *   - B44: under `store: false`, allocates `Array.from(length=callerMax-capped)`
   *     directly (the while-loop would never terminate because
   *     `registry.count` never advances).
   *   - B53 / D8: per-index `options.overrides` are threaded into
   *     `generateAndStorePrimary`, merging at field-level BEFORE
   *     `registry.store` (stored == returned).
   *   - Returns the result PRE-transform; the dispatcher's shared trailing
   *     pass applies `options.transform`.
   */
  private generateArrayPrimary(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    primaryReg: SchemaReg,
    defMin: number,
    defMax: number,
    genPrng: ReturnType<typeof createPrng>,
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    const existingCount = this.registry.count(innerSchema);

    const minRequired = resolveMinRequired(arraySchema, defMin);
    const maxAllowed = resolveMaxAllowed(arraySchema, defMax);
    const target = Math.max(
      existingCount,
      // minRequired always wins as lower bound — schema .min(N) must be
      // honoured even when N exceeds defMax.
      genPrng.int(minRequired, Math.max(minRequired, maxAllowed)),
    );

    // B43 / B52-R2: honour caller-side `.max()` / `.length()` slice on
    // BOTH store-on and store-off paths. Only slice when the caller
    // actually wrote a bound — we MUST NOT slice on the library-side
    // `defMax` fallback.
    const callerMax = readCallerMaxBound(arraySchema);
    const overridesArr = Array.isArray(options?.overrides) ? options.overrides : undefined;

    // B44: under store:false, the while-loop below would never terminate —
    // generateAndStorePrimary skips the registry write (B10-R4 transitive
    // suppression) so `registry.count(innerSchema)` never advances past
    // `existingCount`. Generate directly via Array.from instead. The
    // length already incorporates the B52-R2 callerMax cap so no work
    // is allocated beyond what we will return (no while loop, B44 holds).
    if (!this.effectiveStore) {
      const storeOffLength = callerMax !== undefined ? Math.min(target, callerMax) : target;
      return Array.from({ length: storeOffLength }, (_, i) =>
        this.generateAndStorePrimary(innerSchema, primaryReg, {
          overrides: overridesArr?.[i] as Record<string, unknown> | undefined,
        }),
      );
    }

    while (this.registry.count(innerSchema) < target) {
      const i = this.registry.count(innerSchema); // index of the about-to-be-produced record
      this.generateAndStorePrimary(innerSchema, primaryReg, {
        overrides: overridesArr?.[i] as Record<string, unknown> | undefined,
      });
    }

    const all = this.registry.all(innerSchema);
    // B43: D8 preserved — every returned record was first stored, so
    // the slice is a read-only narrowing of an already-D8-consistent
    // registry view.
    return callerMax !== undefined && all.length > callerMax ? all.slice(0, callerMax) : all;
  }

  /**
   * Ad-hoc arm — no registration; pure schema-based generation.
   *
   * Preserved contracts:
   *   - B52-R7: shares `resolveMinRequired` / `resolveMaxAllowed` with the
   *     other arms.
   *   - Element PRNG forks via `genPrng.fork("[i]")` so element order doesn't
   *     disturb other fields' seeds (D4 / D10).
   *   - B52-R4: applies per-index `options.overrides` via `deepMerge`.
   *   - Returns the result PRE-transform; the dispatcher's shared trailing
   *     pass applies `options.transform`.
   */
  private generateArrayAdHoc(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    defMin: number,
    defMax: number,
    genPrng: ReturnType<typeof createPrng>,
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    // B52-R7: share the bound-resolution helpers instead of inlining.
    const minN = resolveMinRequired(arraySchema, defMin);
    const maxN = resolveMaxAllowed(arraySchema, defMax);
    // minN always wins as lower bound — schema .min(N) must be honoured even
    // when N exceeds defMax (e.g. defaultArrayLength:[1,4] + .min(100) → 100).
    const N = genPrng.int(minN, Math.max(minN, maxN));

    let result: unknown[] = Array.from({ length: N }, (_, i) => {
      const elemPrng = genPrng.fork(`[${i}]`);
      const nextPath = options?.fieldPath ? `${options.fieldPath}.[${i}]` : `[${i}]`;
      return this.generate(innerSchema, {
        prng: elemPrng,
        fieldPath: nextPath,
      });
    });

    if (options?.overrides) {
      const overrides = options.overrides as unknown[];
      result = result.map((item, i) => {
        const ov = overrides[i];
        return ov !== undefined
          ? (deepMerge(item, ov as Record<string, unknown>) as unknown)
          : item;
      });
    }

    return result;
  }

  /**
   * D14 shared trailing pass for `generateArray`. The full D14 sequence is
   * cap → per-index overrides → transform; the cap and per-index overrides
   * are applied AT PRODUCTION TIME inside each per-mode method (required to
   * preserve D8 for derived/primary, where the cap gates `registry.store`
   * and overrides on the primary arm merge before store via
   * `generateAndStorePrimary`). This shared method closes the sequence with
   * `options.transform`, which is uniformly safe to apply post-production
   * across all three arms.
   */
  private applyArrayTrailingPass(
    result: unknown[],
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    if (options?.transform) {
      return result.map(options.transform as unknown as (value: unknown, index: number) => unknown);
    }
    return result;
  }

  /**
   * Collect `(source, reg, sourceIndex)` triples across the given derived
   * registrations by iterating each `reg.from`'s registry sources. When
   * `captured` is provided and a `reg.from` registry is empty, falls back
   * to the captured map (B20 local-capture for `store: false` derived
   * auto-source). Shared between {@link generateArrayDerived} and
   * {@link generateDerivedAutoSource}.
   */
  private collectSourcePairs(
    derivedRegs: SchemaReg[],
    captured?: Map<ZodTypeAny, unknown>,
  ): SourcePair[] {
    const pairs: SourcePair[] = [];
    for (const reg of derivedRegs) {
      const sources = this.registry.all(reg.from!);
      if (sources.length > 0) {
        for (let i = 0; i < sources.length; i++) {
          pairs.push({ source: sources[i], reg, sourceIndex: i });
        }
      } else if (captured?.has(reg.from!)) {
        pairs.push({ source: captured.get(reg.from!), reg, sourceIndex: 0 });
      }
    }
    return pairs;
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
    if (depth > (options?.recursionLimit ?? this.options.recursionLimit ?? 5)) return null;

    // B39 — only the derived-without-source pair picker (below, at the
    // `pairs[idx]` site) still reads this counter. The three former
    // PRNG-fork-key consumers (ad-hoc, array, outer-wrap) moved to
    // `schemaCallCounts` via `nextSchemaSlot`.
    this.derivedPairCounter++;

    const current = resolveLazyChain(schema, this.lazyCache);
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
      const identity = computeSourceIdentity(reg.sourceKey, sourceOverride);
      const isUnique = options?.unique !== false;
      const canUseUpsert = isUnique && this.effectiveStore;

      if (canUseUpsert && this.derivedUpsert !== null) {
        // B97-R15: read-only path — skip the allocation entirely when the
        // map has never been written.
        const existing = getDerivedUpsert(this.derivedUpsert, schema, identity);
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
    const identity = computeSourceIdentity(reg.sourceKey, source);
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
        // B97-R15: allocate on first write.
        setDerivedUpsert(this.ensureDerivedUpsert(), schema, identity, result);
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
    const pairs = this.collectSourcePairs(derivedRegs, captured);

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

// ---------------------------------------------------------------------------
// B97-R15 — test-only escape hatch
//
// Test-only accessor for the lazy `WorldImpl` map invariants (R15). Same
// marker as `__bindCount` in `bind-generators.ts`: NOT part of the public
// API, not re-exported from `src/index.ts`, no entry in
// `docs/api-reference.md`. (R12 and R13 were both reverted — see spec
// Context.)
// ---------------------------------------------------------------------------

interface LazyMapsSnapshot {
  customKeyGenerators: Map<string, KeyGenerator> | null;
  schemaKeyMaps: Map<ZodTypeAny, Record<string, (ctx: GeneratorContext) => unknown>> | null;
  relationPools: Map<string, unknown[]> | null;
  pendingCounts: Map<ZodTypeAny, number> | null;
  derivedUpsert: DerivedUpsertMap | null;
}

interface WorldImplPrivate {
  customKeyGenerators: Map<string, KeyGenerator> | null;
  schemaKeyMaps: Map<ZodTypeAny, Record<string, (ctx: GeneratorContext) => unknown>> | null;
  relationPools: Map<string, unknown[]> | null;
  pendingCounts: Map<ZodTypeAny, number> | null;
  derivedUpsert: DerivedUpsertMap | null;
}

function asPrivate(world: object): WorldImplPrivate {
  return world as unknown as WorldImplPrivate;
}

export function __inspectLazyMaps(world: object): LazyMapsSnapshot {
  const w = asPrivate(world);
  return {
    customKeyGenerators: w.customKeyGenerators,
    schemaKeyMaps: w.schemaKeyMaps,
    relationPools: w.relationPools,
    pendingCounts: w.pendingCounts,
    derivedUpsert: w.derivedUpsert,
  };
}
