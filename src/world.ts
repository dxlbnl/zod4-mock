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
 * 1. Matchers registered via `withSchema`
 * 2. Per-schema key maps registered via `withKeyMap`
 * 3. Key-based generators (field name heuristics)
 * 4. Schema-based generator (Zod type introspection)
 * 5. `options.overrides` deep merge
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
} from "./types.js";
import { SchemaRegistry } from "./registry.js";
import { createPrng, fieldSeed } from "./prng.js";
import { generateFromSchema } from "./generators/schema/index.js";
import { generateFromKey } from "./generators/index.js";
import { def, checks, unwrap, applyModifiers } from "./generators/schema/zod-def.js";
import { deepMerge } from "./utils/merge.js";
import * as generatorsData from "./generators/data/index.js";
import { defaultLocale } from "./default-locale.js";

// ---------------------------------------------------------------------------
// Internal schema registration record
// ---------------------------------------------------------------------------

interface SchemaReg {
  schema: ZodTypeAny;
  from: ZodTypeAny | null;
  relations: Record<string, ZodTypeAny>;
  matchers: Record<string, (ctx: GeneratorContext) => unknown>;
  regId: number;
}

const EMPTY_REG: SchemaReg = {
  schema: {} as ZodTypeAny,
  from: null,
  relations: {},
  matchers: {},
  regId: -1,
};

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
// WorldImpl
// ---------------------------------------------------------------------------

export class WorldImpl implements World {
  readonly prng: ReturnType<typeof createPrng>;
  readonly registry: Registry;

  private readonly schemaRegs: SchemaReg[] = [];
  private generationCounter = 0;
  private readonly rootSeed: number;

  private readonly customKeyGenerators: Map<string, KeyGenerator> = new Map();
  private readonly schemaKeyMaps: Map<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > = new Map();
  private readonly relationPools: Map<string, unknown[]> = new Map();
  private readonly pendingCounts: Map<ZodTypeAny, number> = new Map();
  private lazyCache = new WeakMap<ZodTypeAny, ZodTypeAny>();

  constructor(private readonly options: WorldOptions = {}) {
    this.rootSeed = (options || {}).seed ?? Math.floor(Math.random() * 0xffffffff);
    this.prng = createPrng(this.rootSeed);
    this.registry = new SchemaRegistry(this.prng.fork("registry"));
    for (const [k, fn] of Object.entries(options.generators ?? {})) {
      this.customKeyGenerators.set(k.toLowerCase(), fn);
    }
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
    const relations = opts?.relations ?? {};
    const matchers = (opts?.matchers ?? {}) as unknown as Record<
      string,
      (ctx: GeneratorContext) => unknown
    >;
    this.schemaRegs.push({
      schema,
      from,
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

  populate(schema: ZodTypeAny, count: number): this {
    const primaryRegs = this.findPrimaryRegs(schema);
    const derivedRegs = this.findDerivedRegs(schema);

    if (primaryRegs.length > 0) {
      for (let i = 0; i < count; i++) {
        this.generateAndStorePrimary(schema, primaryRegs[0]!);
      }
    } else if (derivedRegs.length > 0) {
      const reg = derivedRegs[0]!;
      const sources = this.registry.all(reg.from!);
      // Use the count to limit how many we derive, or derive from all if count is large
      const N = Math.min(count, sources.length);
      for (let i = 0; i < N; i++) {
        const result = this.generateDerivedRecord(schema, reg, sources[i], i);
        this.registry.store(schema, result);
      }
    } else {
      // Default to primary if not registered
      for (let i = 0; i < count; i++) {
        this.generateAndStorePrimary(schema, null);
      }
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
        const prng = this.prng.fork(`gen-wrap-${this.generationCounter + 1}`);
        const optProb = this.options.optionalProbability ?? 0.2;
        for (const wrapper of outerWrappers) {
          if (prng.random() < optProb) {
            this.generationCounter++;
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

    return this.generateSingleItem(schema, options as GenerateOptions<unknown>) as z.infer<TSchema>;
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

  private bindGenerators(prng: ReturnType<typeof createPrng>): BoundGenerators {
    const boundCache: Record<string, any> = {};

    return new Proxy({} as BoundGenerators, {
      get: (_target, ns: string) => {
        if (boundCache[ns]) return boundCache[ns];

        const nsObj = (generatorsData as Record<string, any>)[ns];
        if (!nsObj) return undefined;

        const boundNs = new Proxy(nsObj, {
          get: (target, name: string) => {
            const fn = target[name];
            if (typeof fn !== "function") return fn;
            return (...args: unknown[]) => fn(prng, ...args);
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
    return {
      prng: fieldPrng,
      gen: this.bindGenerators(fieldPrng),
      source,
      registry: this.registry,
      fieldPath,
      optionalProbability: this.options.optionalProbability ?? 0.2,
      related: <T = Record<string, unknown>>(relName: string): T =>
        this.resolveRelated<T>(reg, recordPrng, recordId, relName),
      generate: <S extends ZodTypeAny>(s: S, o?: GenerateOptions<z.infer<S>>): z.infer<S> => {
        const nextPath = o?.fieldPath ?? (o?.fieldPath === "" ? "" : fieldPath);
        return this.generate(s, { ...o, fieldPath: nextPath });
      },
      recursionLimit: this.options.recursionLimit ?? 5,
      current: (current ?? {}) as Partial<any>,
      locale: this.options.locale ?? defaultLocale,
    };
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
    const relSchema = reg.relations[relName];
    if (!relSchema) {
      throw new Error(
        `Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`,
      );
    }

    const cacheKey = `${recordId}:${relName}`;
    let items = this.relationPools.get(cacheKey);

    if (!items) {
      if (this.registry.count(relSchema) === 0) {
        this.ensurePrimaryRecord(relSchema);
      }
      items = [...this.registry.all(relSchema)];
      this.relationPools.set(cacheKey, items);
    }

    // Derive a stable per-relation PRNG so all fields in one record pick the same related entity.
    const relPrng = recordPrng.fork(`rel:${relName}`);
    const pickedIdx = relPrng.int(0, items.length - 1);
    // console.log(`[resolveRelated] key=${cacheKey} pool=${items.length} picked=${pickedIdx}`);
    return items[pickedIdx]! as T;
  }

  private ensurePrimaryRecord(schema: ZodTypeAny): void {
    if (this.registry.count(schema) > 0) return;
    const reg = this.findPrimaryRegs(schema)[0] ?? null;
    this.generateAndStorePrimary(schema, reg);
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
      const result = this.generateObjectFields(
        schema,
        effectiveReg,
        undefined,
        recordPrng,
        recordId,
        fieldPath,
        options?.overrides as Record<string, unknown>,
      );
      this.registry.store(schema, result);
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
    return this.generateObjectFields(
      schema,
      reg,
      source,
      recordPrng,
      recordId,
      recordId,
      options?.overrides as Record<string, unknown>,
    );
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
        // Matchers can still be overridden by an explicit object override
        result[key] = fieldOverride !== undefined ? fieldOverride : matcher(fieldCtx);
        continue;
      }

      // 2. Per-schema key map
      const keyMapFn =
        this.schemaKeyMaps.get(schema)?.[key] ?? this.schemaKeyMaps.get(current)?.[key];
      if (keyMapFn !== undefined) {
        result[key] = fieldOverride !== undefined ? fieldOverride : keyMapFn(fieldCtx);
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
        const val = customGen(innerSchema, fieldCtx);
        result[key] =
          fieldOverride !== undefined ? fieldOverride : applyModifiers(val, innerSchema);
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

    this.generationCounter++;
    const genPrng = this.prng.fork(`gen-${this.generationCounter}`);

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

    this.generationCounter++;

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
    const sourceOverride = (options as any)?.source;

    if (sourceOverride !== undefined) {
      const reg = derivedRegs[0] ?? { ...EMPTY_REG, schema };
      result = this.generateDerivedRecord(schema, reg as SchemaReg, sourceOverride, 0, options);
    } else if (derivedRegs.length > 0) {
      // Pick first available source across all derived regs, auto-provisioning if needed
      for (const reg of derivedRegs) {
        if (this.registry.count(reg.from!) === 0) {
          const fromReg = this.findPrimaryRegs(reg.from!)[0] ?? null;
          this.generateAndStorePrimary(reg.from!, fromReg);
        }
      }

      // Collect all (source, reg, index) pairs and pick by generationCounter
      type SourcePair = { source: unknown; reg: SchemaReg; sourceIndex: number };
      const pairs: SourcePair[] = [];
      for (const reg of derivedRegs) {
        const sources = this.registry.all(reg.from!);
        for (let i = 0; i < sources.length; i++) {
          pairs.push({ source: sources[i], reg, sourceIndex: i });
        }
      }

      const idx = (this.generationCounter - 1) % pairs.length;
      const { source, reg, sourceIndex } = pairs[idx]!;
      result = this.generateDerivedRecord(schema, reg, source, sourceIndex, options);
    } else if (primaryRegs.length > 0) {
      result = this.generateAndStorePrimary(schema, primaryRegs[0]!, options);
    } else {
      // Ad-hoc
      const recordId = `adhoc-${this.generationCounter}`;
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
    if (options?.transform) result = options.transform(result as input<ZodTypeAny>);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createWorld(options?: WorldOptions): World {
  return new WorldImpl(options ?? {});
}
