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
import type { WorldTrace, TraceNode, TraceField, TraceResolution } from "../trace.js";
import { SchemaRegistry } from "../registry.js";
import { createPrng, fieldSeed, fnv1a } from "../prng.js";
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
import { PIPELINE, walkPipeline, traceResolutionForKind, applyOverride } from "../pipeline.js";
import type { FieldResolution } from "../pipeline.js";
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

// Schema-reference identity must be process-stable across worlds (call-order
// independence: worldA.generate(X) and worldB.generate(Y); worldB.generate(X)
// must agree on X), so the id map is module-global, not per-world. It MUST stay
// a single module-level instance — splitting the engine MUST NOT duplicate it.
const globalSchemaIds: WeakMap<ZodTypeAny, number> = new WeakMap();
let nextGlobalSchemaId = 0;

// Read-only empty-map sentinels shared across worlds (avoid a per-world empty-Map
// allocation when the per-instance map is still null). Never `.set(...)` into them.
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

function resolveTraceTypeName(schema: ZodTypeAny): string {
  const description = schema.description;
  if (typeof description === "string" && description.length > 0) return description;
  return `schema${getSchemaId(schema)}`;
}

function resolveTraceTypeNames(regs: readonly SchemaReg[]): Map<number, string> {
  const names = new Map<number, string>();
  const counts = new Map<string, number>();
  for (const reg of regs) {
    const base = resolveTraceTypeName(reg.schema);
    const polarity = reg.from !== null ? "d" : "p";
    const groupKey = `${polarity}:${base}`;
    const n = (counts.get(groupKey) ?? 0) + 1;
    counts.set(groupKey, n);
    names.set(reg.regId, n === 1 ? base : `${base}-${n}`);
  }
  return names;
}

type CapturedField = Omit<TraceField, "forkKey">;

// Read-tracking Proxy installed only under the `trace: true` gate; its get-trap
// records each sibling key a matcher reads to populate TraceField.dependsOn.
function trackReads(target: Record<string, unknown>, reads: Set<string>): Record<string, unknown> {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === "string") reads.add(prop);
      return Reflect.get(t, prop, receiver);
    },
  });
}

function captureField(
  path: string,
  resolution: FieldResolution,
  overridden: boolean,
  explainMeta: { identifier?: string; reason?: string } | null,
  reads: Set<string> | null,
): CapturedField {
  const traceResolution: TraceResolution = traceResolutionForKind(resolution.kind);
  return {
    path,
    value: resolution.value,
    resolution: traceResolution,
    generator: explainMeta?.identifier ?? "schema-based",
    reason: explainMeta?.reason ?? "no key match, no matcher",
    overridden,
    dependsOn: reads !== null ? [...reads] : [],
  };
}

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

// Caller-side upper bound (`.max()` / `.length()`), `undefined` when absent.
// Unlike resolveMaxAllowed it does NOT fold in the library `defaultArrayLength`
// fallback — slicing on that fallback would silently cap populate + generate.
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

type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };

// Stable per-source field-PRNG index for the explicit-source derived path.
// Keyed on the identity VALUE (not a call counter) so it stays order-independent;
// distinct sources MUST map to distinct indices or every derived record collapses
// to the same field seed.
function sourceFieldIndex(identity: unknown): number {
  let key: string;
  if (identity !== null && typeof identity === "object") {
    try {
      key = JSON.stringify(identity);
    } catch {
      // Circular/unstringifiable — fall back to the type tag.
      key = Object.prototype.toString.call(identity);
    }
  } else {
    key = String(identity);
  }
  return fnv1a(key);
}

export class WorldImpl implements World {
  readonly prng: ReturnType<typeof createPrng>;
  readonly registry: Registry;

  private readonly schemaRegs: SchemaReg[] = [];
  // Round-robin index for the derived-without-source pair picker; incremented at
  // the top of generateSingleItem and rolled back by the upsert short-circuit.
  private derivedPairCounter = 0;
  // Per-schema call slot (the "Nth call" fork-key component). Scoped per-world;
  // an intervening generate(Y) leaves X's slot untouched (call-order independence).
  // The schema-identity component of the fork key is module-global (getSchemaId).
  private readonly schemaCallCounts: WeakMap<ZodTypeAny, number> = new WeakMap();
  private readonly rootSeed: number;

  // The lazy maps below allocate on first write (via the ensureXxx helpers); a
  // world that configures nothing leaves them null. Reads use `?.get(...)`.
  private customKeyGenerators: Map<string, KeyGenerator> | null = null;
  private schemaKeyMaps: Map<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > | null = null;
  private relationPools: Map<string, unknown[]> | null = null;
  private pendingCounts: Map<ZodTypeAny, number> | null = null;
  // Per-(derived schema, source identity) upsert map; stores the post-transform
  // record (same reference held in the registry). Lazy via ensureDerivedUpsert.
  private derivedUpsert: DerivedUpsertMap | null = null;
  private lazyCache = new WeakMap<ZodTypeAny, ZodTypeAny>();
  // Effective per-outer-call storage mode; when false the registry.store side-
  // effects are skipped. Propagates through recursion, scoped via try/finally.
  private effectiveStore = true;

  // Per-call overrides set from generate() options, propagated through recursion
  // via the matching withEffectiveX push/pop scopes; undefined ⇒ inherit/fall back.
  private effectiveLocale: LocaleData | undefined = undefined;
  private effectiveDefaultArrayLength: readonly [number, number] | undefined = undefined;
  // unique:true makes pickZipf substitute s=0 (uniqueness wins over realism).
  private effectiveUniqueMode = false;

  private readonly relations: RelationResolver;

  // Mutable per-generate() holder for the lazy generator binder. The field loop
  // mutates state.prng / state.ctx in place so bound closures observe per-field
  // state at call time without rebinding; scoped to the outer call.
  private fieldState: FieldState | null = null;
  private boundGen: BoundGenerators | null = null;

  // traceEnabled mirrors createWorld({ trace: true }). When false (default) the
  // per-field capture is a no-op (no Proxy, no allocation) so the off-path stays
  // allocation- and PRNG-neutral. captureSink keys each record to its fields.
  private readonly traceEnabled: boolean;
  private captureSink: WeakMap<object, CapturedField[]> | null = null;

  constructor(private readonly options: WorldOptions = {}) {
    this.traceEnabled = options.trace === true;
    this.rootSeed = (options || {}).seed ?? Math.floor(Math.random() * 0xffffffff);
    this.prng = createPrng(this.rootSeed);
    this.registry = new SchemaRegistry(this.prng.fork("registry"));
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
      getRelationPools: () => this.ensureRelationPools(),
      findPrimaryReg: (schema) => this.findPrimaryRegs(schema)[0] ?? null,
      generateAndStorePrimary: (schema, reg) => this.generateAndStorePrimary(schema, reg),
      isStoreActive: () => this.effectiveStore,
    });
  }

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

  private ensureCaptureSink(): WeakMap<object, CapturedField[]> {
    if (this.captureSink === null) {
      this.captureSink = new WeakMap();
    }
    return this.captureSink;
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

  // Pass the OUTER schema reference (not a re-resolved inner type) so identity
  // is stable across lazy re-resolutions and .optional()/.array() wrappers.
  private nextSchemaSlot(schema: ZodTypeAny, commit: boolean = true): { id: number; slot: number } {
    const id = getSchemaId(schema);
    const slot = (this.schemaCallCounts.get(schema) ?? 0) + 1;
    if (commit) {
      this.schemaCallCounts.set(schema, slot);
    }
    return { id, slot };
  }

  withSchema<
    TSchema extends ZodTypeAny,
    TSource extends ZodTypeAny | undefined = undefined,
    TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
  >(schema: TSchema, opts?: SchemaOpts<TSchema, TSource, TRelations>): this {
    // Mixing primary/derived polarity for one schema reference throws BEFORE the
    // SchemaReg is appended, so a failed call leaves schemaRegs unchanged.
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

  populate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    count: number,
    factory?: (index: number) => GenerateOptions<z.infer<TSchema>>,
  ): this {
    // populate always writes the registry — a factory's `store: false` is
    // silently ignored, so strip it before threading options through.
    const factoryOpts = factory
      ? (i: number): GenerateOptions<unknown> => {
          const raw = factory(i) as GenerateOptions<unknown> & { store?: boolean };
          const { store: _ignored, ...rest } = raw;
          return rest;
        }
      : undefined;

    const mode = this.resolveMode(schema);
    switch (mode.kind) {
      case "derived": {
        const reg = mode.regs[0]!;
        const fromSchema = reg.from!;
        const sources = this.registry.all(fromSchema);
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
        for (let i = 0; i < count; i++) {
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          this.generateAndStorePrimary(schema, mode.reg, opts);
        }
        break;
      }
      case "ad-hoc":
        for (let i = 0; i < count; i++) {
          const opts = factoryOpts ? factoryOpts(i) : undefined;
          this.generateAndStorePrimary(schema, null, opts);
        }
        break;
    }
    return this;
  }

  populateFrom<TDerived extends ZodTypeAny, TSource extends ZodTypeAny>(
    derivedSchema: TDerived,
    sourceSchema: TSource,
    predicate?: (item: z.infer<TSource>) => boolean,
    factory?: (source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>,
  ): this {
    // Snapshot the source bucket so mid-loop inserts don't extend this call.
    const snapshot = [...this.registry.all(sourceSchema)];
    const sources = predicate ? snapshot.filter(predicate) : snapshot;

    for (const source of sources) {
      // populateFrom always writes — strip any factory `store: false`.
      const factoryReturn = factory?.(source);
      const { store: _ignored, ...rest } = (factoryReturn ?? {}) as GenerateOptions<
        z.infer<TDerived>
      > & {
        store?: boolean;
      };
      // Delegate to generate so a repeat call with the same source identity
      // hits the per-pair upsert (idempotence).
      this.generate(derivedSchema, {
        ...rest,
        source,
      } as GenerateOptions<z.infer<TDerived>>);
    }

    return this;
  }

  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<z.infer<TSchema>>,
  ): z.infer<TSchema> {
    return this.withFieldStateScope(() =>
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
                  // Key the wrapper roll on the outer schema reference so the Nth
                  // call to the same .optional() reuses the same fork key
                  // regardless of intervening generate(Y) calls.
                  const { id, slot } = this.nextSchemaSlot(schema);
                  const prng = this.prng.fork(`wrap:${id}:${slot}`);
                  const optProb =
                    options?.optionalProbability ?? this.options.optionalProbability ?? 0.2;
                  for (const wrapper of outerWrappers) {
                    if (prng.random() < optProb) {
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

  explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema> {
    // Last withSchema wins for matchers (mirrors generateObjectFields).
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
      customKeyGenerators: this.customKeyGenerators ?? EMPTY_CUSTOM_KEY_GENERATORS,
      relations: reg?.relations ?? {},
    });
  }

  trace(): WorldTrace {
    // Dedup registrations by schema reference (re-registering the same reference
    // is not a new node source and never advances a collision suffix).
    const regs: SchemaReg[] = [];
    const seen = new Set<ZodTypeAny>();
    for (const reg of this.schemaRegs) {
      if (seen.has(reg.schema)) continue;
      seen.add(reg.schema);
      regs.push(reg);
    }

    const typeNames = resolveTraceTypeNames(regs);

    const nodes: TraceNode[] = [];
    for (const reg of regs) {
      const derived = reg.from !== null;
      const type = typeNames.get(reg.regId)!;
      const sourceReg = derived ? (this.findPrimaryRegs(reg.from!)[0] ?? null) : null;
      const sourceType = sourceReg ? typeNames.get(sourceReg.regId) : undefined;

      const records = this.registry.all(reg.schema);
      records.forEach((value, index) => {
        const nodeId = `${type}#${index + 1}`;
        const captured =
          value !== null && typeof value === "object"
            ? this.captureSink?.get(value as object)
            : undefined;
        const fields: TraceField[] = captured
          ? captured.map((cf) => ({ ...cf, forkKey: `${nodeId} ▸ ${cf.path}` }))
          : [];
        const node: TraceNode = {
          id: nodeId,
          type,
          // The numeric index stays 0-based; only the string id/derivedFrom is 1-based.
          index,
          value,
          store: true,
          fields,
          // Primary records OMIT derivedFrom entirely ("derivedFrom" in node === false).
          ...(derived && sourceType !== undefined
            ? { derivedFrom: `${sourceType}#${index + 1}` }
            : {}),
        };
        nodes.push(node);
      });
    }
    return { seed: this.rootSeed, nodes, edges: [] };
  }

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

    // get's create path MUST always store (idempotence: a later find/get must
    // discover it) regardless of any ambient store mode.
    const created = this.generate(
      schema,
      predicate
        ? ({ overrides: predicate, store: true } as GenerateOptions<z.infer<TSchema>>)
        : ({ store: true } as GenerateOptions<z.infer<TSchema>>),
    );

    const isRegistered = this.resolveMode(schema).kind !== "ad-hoc";

    if (!isRegistered) {
      // generate does not store ad-hoc schemas — store it so find/get discovers it.
      this.registry.store(schema, created as input<TSchema>);
      return created;
    }

    // generate's returned instance is a post-merge copy distinct from the stored
    // one; return the stored instance so later get calls resolve by reference.
    const stored = this.registry.find(schema, matches);
    return stored ?? created;
  }

  private findPrimaryRegs(schema: ZodTypeAny): SchemaReg[] {
    return findPrimaryRegsPure(this.schemaRegs, schema);
  }

  private findDerivedRegs(schema: ZodTypeAny): SchemaReg[] {
    return findDerivedRegsPure(this.schemaRegs, schema);
  }

  private resolveMode(schema: ZodTypeAny): SchemaMode {
    return resolveModePure(this.schemaRegs, schema);
  }

  // Push/pop a per-outer-call effective flag for the duration of fn; undefined
  // inherits the ambient value. The try/finally scopes transitive suppression
  // (e.g. store: false) to one outer generate call.
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

  // Only value === true activates unique mode; an explicit false is a no-op.
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

  // Save/restore the lazy-binder holder + boundGen pair so a nested ctx.generate
  // doesn't clobber a captured outer ctx.gen reference; each outer call gets its
  // own pair while binding stays amortised across that call's fields.
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

  // recordPrng is the stable per-record PRNG used for relation resolution so
  // ctx.related("owner") returns the same owner across every field; fieldPrng is
  // field-seeded and drives all data generation. The per-field ctx literal (not a
  // shared+mutated object) keeps a monomorphic shape for V8 inline caching.
  private makeFieldCtx(
    reg: SchemaReg,
    source: unknown,
    recordPrng: ReturnType<typeof createPrng>,
    fieldPrng: ReturnType<typeof createPrng>,
    fieldPath: string,
    recordId: string,
    current?: Record<string, unknown>,
    overrideArrayLength?: number,
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
    // Under unique mode, wrap fieldPrng so pickZipf substitutes s = 0 (uniqueness
    // wins over realism); all other methods delegate verbatim. Wrapping at the
    // field boundary covers both ctx.prng and the ctx.gen.* namespace.
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
      locale: this.effectiveLocale ?? this.options.locale ?? defaultLocale,
      defaultArrayLength: this.effectiveDefaultArrayLength ??
        this.options.defaultArrayLength ?? [1, 5],
      // Omitted when no array override (exactOptionalPropertyTypes) so the
      // no-override path stays byte-identical.
      ...(overrideArrayLength !== undefined ? { overrideArrayLength } : {}),
    };
    state.ctx = ctx;
    return ctx;
  }

  private generateAndStorePrimary(
    schema: ZodTypeAny,
    reg: SchemaReg | null,
    options?: GenerateOptions<unknown>,
    explicitRecordIndex?: number,
  ): unknown {
    const pendingMap = this.ensurePendingCounts();
    const pending = pendingMap.get(schema) ?? 0;
    // Under store:false the per-element index self-cancels (registry.count never
    // advances, pending cycles 0→1→0) and collapses siblings to one seed, so an
    // explicit per-element index is honoured there. It MUST stay gated on
    // !effectiveStore: on the store-on path registry.count + pending is also what
    // re-entrant generation relies on (a child mid-parent enters at pending > 0).
    const recordIndex =
      !this.effectiveStore && explicitRecordIndex !== undefined
        ? explicitRecordIndex
        : this.registry.count(schema) + pending;
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
      if (this.effectiveStore) {
        this.registry.store(schema, result);
      }
      return result;
    } finally {
      const currentPending = pendingMap.get(schema) ?? 1;
      pendingMap.set(schema, currentPending - 1);
    }
  }

  private generateDerivedRecord(
    schema: ZodTypeAny,
    reg: SchemaReg,
    source: unknown,
    sourceIndex: number,
    options?: GenerateOptions<unknown>,
  ): unknown {
    // Key the derived field-PRNG seed on the module-global schema identity
    // (getSchemaId), NOT reg.regId — keying on regId made output depend on how
    // many unrelated withSchema calls preceded it (call-order independence).
    const recordId = `dreg${getSchemaId(schema)}#${sourceIndex}`;
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
    // null off-path (no allocation, no Proxy); under the trace gate, collects each
    // field's provenance and attaches it to the record after the loop.
    const captured: CapturedField[] | null = this.traceEnabled ? [] : null;

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldPrng = recordPrng.fork(key);
      const fieldPath = fieldPathPrefix ? `${fieldPathPrefix}.${key}` : key;
      const fs = fieldSchema as ZodTypeAny;
      const resolution = this.resolveField(
        key,
        fs,
        result,
        { schema, current, reg, source, recordPrng, fieldPrng, fieldPath, recordId, overrides },
        captured,
      );
      // A skipped optional ("absent") omits the key ("key" in record === false).
      if (resolution.kind !== "absent") result[key] = resolution.value;
    }
    if (captured !== null) this.ensureCaptureSink().set(result, captured);
    return result;
  }

  private resolveField(
    key: string,
    fs: ZodTypeAny,
    result: Record<string, unknown>,
    f: {
      schema: ZodTypeAny;
      current: ZodTypeAny;
      reg: SchemaReg;
      source: unknown;
      recordPrng: ReturnType<typeof createPrng>;
      fieldPrng: ReturnType<typeof createPrng>;
      fieldPath: string;
      recordId: string;
      overrides: Record<string, unknown> | undefined;
    },
    captured: CapturedField[] | null,
  ): FieldResolution {
    const reads: Set<string> | null = captured !== null ? new Set() : null;
    const current = reads !== null ? trackReads(result, reads) : result;
    const fieldOverride = f.overrides?.[key];
    // An array override sets the element count; thread its length so the field's
    // array generation produces exactly that many base elements (override wins).
    const overrideArrayLength = Array.isArray(fieldOverride) ? fieldOverride.length : undefined;
    const fieldCtx = this.makeFieldCtx(
      f.reg,
      f.source,
      f.recordPrng,
      f.fieldPrng,
      f.fieldPath,
      f.recordId,
      current,
      overrideArrayLength,
    );
    const explainMeta = captured !== null ? {} : null;
    const stepCtx = {
      fieldSchema: fs,
      fieldName: key,
      fieldCtx,
      fieldOverride,
      reg: f.reg,
      outerSchema: f.schema,
      resolvedSchema: f.current,
      customKeyGenerators: this.customKeyGenerators ?? EMPTY_CUSTOM_KEY_GENERATORS,
      schemaKeyMaps: this.schemaKeyMaps ?? EMPTY_SCHEMA_KEY_MAPS,
      optionalProbability: this.options.optionalProbability ?? 0.2,
      dryRun: false,
      state: { inner: fs },
      explainMeta,
    };
    // An EXPLICIT undefined override (key present with value undefined) forces the
    // field to undefined; overrides[key] can't distinguish that from an absent key,
    // so the `key in overrides` check restores it. The no-override path walks the
    // pipeline directly (no closure, no extra PRNG draw).
    const explicitUndefined =
      fieldOverride === undefined && f.overrides !== undefined && key in f.overrides;
    const resolution: FieldResolution = explicitUndefined
      ? { kind: "override", value: undefined }
      : fieldOverride === undefined
        ? walkPipeline(PIPELINE, stepCtx)
        : applyOverride(fieldOverride, () => walkPipeline(PIPELINE, stepCtx));
    if (captured !== null) {
      captured.push(captureField(key, resolution, fieldOverride !== undefined, explainMeta, reads));
    }
    return resolution;
  }

  private generateArray(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    options?: GenerateOptions<unknown[]>,
  ): unknown[] {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (options?.recursionLimit ?? this.options.recursionLimit ?? 5)) return [];

    // Key the array PRNG on the outer arraySchema reference, NOT the inner
    // element schema — the latter would coalesce z.array(X).min(3) and
    // z.array(X).max(5) into one slot bucket.
    const { id: arrayId, slot: arraySlot } = this.nextSchemaSlot(arraySchema);
    const genPrng = this.prng.fork(`array:${arrayId}:${arraySlot}`);

    const [defMin, defMax] = this.effectiveDefaultArrayLength ??
      this.options.defaultArrayLength ?? [1, 5];
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

  private generateArrayDerived(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    defMin: number,
    defMax: number,
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    const pairs = this.collectSourcePairs(derivedRegs);

    // An override array sets the element count (length wins over schema bounds /
    // defaultArrayLength) and raises the floor so enough sources are provisioned.
    const overridesArr = Array.isArray(options?.overrides) ? options.overrides : undefined;
    const minRequired =
      overridesArr !== undefined
        ? Math.max(resolveMinRequired(arraySchema, defMin), overridesArr.length)
        : resolveMinRequired(arraySchema, defMin);
    // Base each provisioned sourceIndex on the count captured BEFORE provisioning
    // (fromBase) + a per-schema offset: under store:false registry.count stays
    // frozen, so the naive registry.count would collapse all sources to one index.
    const fromBase = new Map<ZodTypeAny, number>();
    const fromProvisioned = new Map<ZodTypeAny, number>();
    while (pairs.length < minRequired) {
      const regIdx = pairs.length % derivedRegs.length;
      const reg = derivedRegs[regIdx]!;
      const fromSchema = reg.from!;
      const fromReg = this.findPrimaryRegs(fromSchema)[0] ?? null;
      if (!fromBase.has(fromSchema)) {
        fromBase.set(fromSchema, this.registry.count(fromSchema));
      }
      const offset = fromProvisioned.get(fromSchema) ?? 0;
      // Store-on is byte-identical: registry.count yielded base, base+1, … —
      // exactly what fromBase + offset gives.
      const sourceIndex = fromBase.get(fromSchema)! + offset;
      fromProvisioned.set(fromSchema, offset + 1);
      const newSource = this.generateAndStorePrimary(fromSchema, fromReg, undefined, sourceIndex);
      pairs.push({ source: newSource, reg, sourceIndex });
    }

    // Cap BEFORE production so no record past the cap is generated or stored
    // (stored = returned). The floor (minRequired) wins when it exceeds the cap.
    // An override array forces the count to exactly its length (override wins).
    const callerMax = readCallerMaxBound(arraySchema);
    const upper = callerMax ?? defMax;
    const cap =
      overridesArr !== undefined
        ? overridesArr.length
        : Math.max(minRequired, Math.min(upper, pairs.length));
    const capped = pairs.slice(0, cap);

    let result: unknown[] = capped.map(({ source, reg, sourceIndex }) => {
      const record = this.generateDerivedRecord(innerSchema, reg, source, sourceIndex);
      if (this.effectiveStore) {
        this.registry.store(innerSchema, record as input<ZodTypeAny>);
      }
      return record;
    });

    if (options?.overrides) {
      const overrides = options.overrides as unknown[];
      result = result.map((item, i) => {
        const ov = overrides[i];
        return ov !== undefined ? deepMerge(item, ov as Record<string, unknown>) : item;
      });
    }
    return result;
  }

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
    const overridesArr = Array.isArray(options?.overrides) ? options.overrides : undefined;
    // An override array sets the result length to max(existingCount, override.length)
    // — already-stored records pin the floor (stored = returned), the override wins
    // over schema/default count and over an explicit .length(N).
    const target =
      overridesArr !== undefined
        ? Math.max(existingCount, overridesArr.length)
        : Math.max(
            existingCount,
            // minRequired wins as lower bound — schema .min(N) honoured even past defMax.
            genPrng.int(minRequired, Math.max(minRequired, maxAllowed)),
          );

    // Slice only on a caller-written .max()/.length() (NOT the library defMax
    // fallback) on both store paths; an override array wins, suppressing the slice.
    const callerMax = overridesArr !== undefined ? undefined : readCallerMaxBound(arraySchema);

    // Under store:false the while-loop never terminates (registry.count never
    // advances past existingCount), so generate directly via Array.from.
    if (!this.effectiveStore) {
      const storeOffLength = callerMax !== undefined ? Math.min(target, callerMax) : target;
      return Array.from({ length: storeOffLength }, (_, i) =>
        // Thread an explicit per-element index (existingCount + i) so the i-th
        // store-off element seeds from the same recordId the store-on while loop
        // produces at that position (suppressed writes would otherwise collapse them).
        this.generateAndStorePrimary(
          innerSchema,
          primaryReg,
          {
            overrides: overridesArr?.[i] as Record<string, unknown> | undefined,
          },
          existingCount + i,
        ),
      );
    }

    while (this.registry.count(innerSchema) < target) {
      const i = this.registry.count(innerSchema);
      this.generateAndStorePrimary(innerSchema, primaryReg, {
        overrides: overridesArr?.[i] as Record<string, unknown> | undefined,
      });
    }

    const all = this.registry.all(innerSchema);
    return callerMax !== undefined && all.length > callerMax ? all.slice(0, callerMax) : all;
  }

  private generateArrayAdHoc(
    innerSchema: ZodTypeAny,
    arraySchema: ZodTypeAny,
    defMin: number,
    defMax: number,
    genPrng: ReturnType<typeof createPrng>,
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    const minN = resolveMinRequired(arraySchema, defMin);
    const maxN = resolveMaxAllowed(arraySchema, defMax);
    // An override array's length wins over schema bounds / defaultArrayLength;
    // otherwise minN wins as lower bound (schema .min(N) honoured even past defMax).
    const overridesArr = Array.isArray(options?.overrides) ? options.overrides : undefined;
    const N =
      overridesArr !== undefined ? overridesArr.length : genPrng.int(minN, Math.max(minN, maxN));

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

  // Closes the cap → overrides → transform sequence with transform only; the cap
  // and per-index overrides are applied at production time inside each arm (they
  // must precede registry.store to preserve stored = returned).
  private applyArrayTrailingPass(
    result: unknown[],
    options: GenerateOptions<unknown[]> | undefined,
  ): unknown[] {
    if (options?.transform) {
      return result.map(options.transform as unknown as (value: unknown, index: number) => unknown);
    }
    return result;
  }

  // When captured is provided and a reg.from registry is empty, falls back to the
  // captured map (local-capture for the store:false derived auto-source path).
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

  private generateSingleItem(schema: ZodTypeAny, options?: GenerateOptions<unknown>): unknown {
    const fieldPath = options?.fieldPath ?? "";
    const depth = fieldPath ? fieldPath.split(".").filter(Boolean).length : 0;
    if (depth > (options?.recursionLimit ?? this.options.recursionLimit ?? 5)) return null;

    this.derivedPairCounter++;

    const current = resolveLazyChain(schema, this.lazyCache);
    const targetSchema = current;

    // Two-level fallback for lazy-resolve: prefer the outer schema reference,
    // fall back to the resolved targetSchema (either may carry the registration).
    let mode = this.resolveMode(schema);
    if (mode.kind === "ad-hoc" && targetSchema !== schema) {
      mode = this.resolveMode(targetSchema);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceOverride = (options as any)?.source;

    let result: unknown;
    let transformApplied = false;

    if (sourceOverride !== undefined) {
      // The upsert short-circuit lives here so the derivedPairCounter-- rollback
      // runs before the helper — an upsert hit must leave no per-world state behind.
      const derivedRegs = mode.kind === "derived" ? mode.regs : [];
      const reg = (derivedRegs[0] ?? { ...EMPTY_REG, schema }) as SchemaReg;
      const identity = computeSourceIdentity(reg.sourceKey, sourceOverride);
      const isUnique = options?.unique !== false;
      const canUseUpsert = isUnique && this.effectiveStore;

      if (canUseUpsert && this.derivedUpsert !== null) {
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

    // No whole-record override merge here: overrides are resolved per-field at the
    // single site inside generateObjectFields (a second pass would re-clobber the
    // per-index array merge).
    if (options?.transform && !transformApplied) {
      result = options.transform(result as input<ZodTypeAny>);
    }
    return result;
  }

  private generateWithSourceOverride(
    schema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    source: unknown,
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    const reg = (derivedRegs[0] ?? { ...EMPTY_REG, schema }) as SchemaReg;
    const identity = computeSourceIdentity(reg.sourceKey, source);
    const isUnique = options?.unique !== false;

    // Seed the field PRNG from the SOURCE IDENTITY, not a hardcoded 0 — a literal 0
    // collapsed every explicit-source derived record to the same field seed.
    // (generateDerivedRecord already applies overrides + transform; don't re-apply.)
    const result = this.generateDerivedRecord(
      schema,
      reg,
      source,
      sourceFieldIndex(identity),
      options,
    );

    // Suppress BOTH the registry and upsert writes together under store:false so a
    // later default-mode call can't resolve to a record absent from the registry.
    if (this.effectiveStore) {
      this.registry.store(schema, result as input<ZodTypeAny>);
      if (isUnique) {
        setDerivedUpsert(this.ensureDerivedUpsert(), schema, identity, result);
      }
    }

    return result;
  }

  private generateDerivedAutoSource(
    schema: ZodTypeAny,
    derivedRegs: SchemaReg[],
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    // Under store:false the auto-provision write is suppressed, so capture the
    // freshly generated source locally (keyed by reg.from, reused across regs that
    // share a source) and fall back to it when the registry read still returns [].
    const captured = new Map<ZodTypeAny, unknown>();
    for (const reg of derivedRegs) {
      if (this.registry.count(reg.from!) === 0 && !captured.has(reg.from!)) {
        const fromReg = this.findPrimaryRegs(reg.from!)[0] ?? null;
        const fresh = this.generateAndStorePrimary(reg.from!, fromReg);
        captured.set(reg.from!, fresh);
      }
    }

    const pairs = this.collectSourcePairs(derivedRegs, captured);

    const idx = (this.derivedPairCounter - 1) % pairs.length;
    const { source, reg, sourceIndex } = pairs[idx]!;
    const result = this.generateDerivedRecord(schema, reg, source, sourceIndex, options);

    if (this.effectiveStore) {
      this.registry.store(schema, result as input<ZodTypeAny>);
    }

    return result;
  }

  private generatePrimary(
    schema: ZodTypeAny,
    primaryReg: SchemaReg,
    options: GenerateOptions<unknown> | undefined,
  ): unknown {
    // Thread an explicit per-element recordIndex (the nested-field array path
    // generates one element at a time) so each store-off element seeds distinctly.
    return this.generateAndStorePrimary(schema, primaryReg, options, options?.recordIndex);
  }

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

/**
 * Create a {@link World} — the central, deterministic generation session.
 * Chain `.withSchema` / `.withGenerators` / `.withKeyMap` to configure it, then
 * `.generate` / `.populate` to produce data. One world = one seed = one dataset.
 *
 * @param options - World-wide settings ({@link WorldOptions}); the `seed`
 * fixes determinism.
 *
 * @example
 * ```ts
 * import { createWorld } from "zod4-mock";
 *
 * const world = createWorld({ seed: 1 });
 * world.withSchema(UserSchema);
 * const user = world.generate(UserSchema);
 * ```
 */
export function createWorld(options?: WorldOptions): World {
  return new WorldImpl(options ?? {});
}

// Test-only accessor for the lazy WorldImpl map invariants; not public API.
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
