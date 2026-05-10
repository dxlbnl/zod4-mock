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
  PrimarySchemaOpts,
  DerivedSchemaOpts,
} from "./types.js";
import { SchemaRegistry } from "./registry.js";
import { createPrng, fieldSeed } from "./prng.js";
import { generateFromSchema } from "./generators/schema/index.js";
import { generateFromKey } from "./generators/index.js";
import { def, checks } from "./generators/schema/zod-def.js";
import * as generatorsData from "./generators/data/index.js";

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
// Deep merge helper (non-array, non-null objects only)
// ---------------------------------------------------------------------------

function deepMerge(target: unknown, source: unknown): unknown {
  if (
    typeof source !== "object" ||
    source === null ||
    Array.isArray(source) ||
    typeof target !== "object" ||
    target === null ||
    Array.isArray(target)
  ) {
    return source;
  }
  const result = { ...(target as Record<string, unknown>) };
  for (const [k, sv] of Object.entries(source as Record<string, unknown>)) {
    if (sv !== undefined) {
      result[k] = deepMerge(result[k], sv);
    }
  }
  return result;
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
// WorldImpl
// ---------------------------------------------------------------------------

export class WorldImpl implements World {
  private readonly prng: ReturnType<typeof createPrng>;
  readonly registry: Registry;

  private readonly schemaRegs: SchemaReg[] = [];
  private generationCounter = 0;

  private readonly customKeyGenerators: Map<string, KeyGenerator> = new Map();
  private readonly schemaKeyMaps: Map<ZodTypeAny, Record<string, (ctx: GeneratorContext) => unknown>> = new Map();

  constructor(private readonly options: WorldOptions) {
    this.prng = createPrng(options.seed);
    this.registry = new SchemaRegistry(this.prng.fork("registry"));
    for (const [k, fn] of Object.entries(options.generators ?? {})) {
      this.customKeyGenerators.set(k.toLowerCase(), fn);
    }
  }

  // -------------------------------------------------------------------------
  // withSchema
  // -------------------------------------------------------------------------

  withSchema<TSchema extends ZodTypeAny>(
    schema: TSchema,
    opts?: PrimarySchemaOpts<TSchema>,
  ): this;
  withSchema<TSchema extends ZodTypeAny, TSource extends ZodTypeAny>(
    schema: TSchema,
    opts: DerivedSchemaOpts<TSchema, TSource>,
  ): this;
  withSchema(schema: ZodTypeAny, opts?: PrimarySchemaOpts<ZodTypeAny> | DerivedSchemaOpts<ZodTypeAny, ZodTypeAny>): this {
    const from = opts && "from" in opts ? opts.from ?? null : null;
    const relations = opts?.relations ?? {};
    const matchers = (opts?.matchers ?? {}) as Record<string, (ctx: GeneratorContext) => unknown>;
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
    for (let i = 0; i < count; i++) {
      const reg = this.findPrimaryRegs(schema)[0] ?? null;
      this.generateAndStorePrimary(schema, reg);
    }
    return this;
  }

  // -------------------------------------------------------------------------
  // generate
  // -------------------------------------------------------------------------

  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<input<TSchema>>,
  ): input<TSchema> {
    let current: ZodTypeAny = schema;
    let d = def(current);
    const outerWrappers: Array<"optional" | "nullable"> = [];

    while (d.innerType && (d.type === "optional" || d.type === "nullable")) {
      outerWrappers.push(d.type);
      current = d.innerType;
      d = def(current);
    }

    if (d.type === "array") {
      if (outerWrappers.length > 0) {
        const prng = this.prng.fork(`gen-wrap-${this.generationCounter + 1}`);
        const optProb = this.options.optionalProbability ?? 0.2;
        for (const wrapper of outerWrappers) {
          if (prng.random() < optProb) {
            this.generationCounter++;
            return (wrapper === "optional" ? undefined : null) as input<TSchema>;
          }
        }
      }
      return this.generateArray(
        d.element!,
        current,
        options as GenerateOptions<unknown[]> | undefined,
      ) as input<TSchema>;
    }

    return this.generateSingleItem(schema, options as GenerateOptions<unknown>) as input<TSchema>;
  }

  // -------------------------------------------------------------------------
  // Private: registration lookups
  // -------------------------------------------------------------------------

  private findAllRegs(schema: ZodTypeAny): SchemaReg[] {
    return this.schemaRegs.filter((r) => r.schema === schema);
  }

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
    const result: BoundGenerators = {};
    for (const [ns, nsObj] of Object.entries(generatorsData)) {
      const boundNs: Record<string, (...args: unknown[]) => unknown> = {};
      // Cast to a uniform function type — actual signatures vary per generator but callers
      // access through BoundGenerators which erases the per-function types intentionally.
      const fns = nsObj as Record<string, (p: ReturnType<typeof createPrng>, ...rest: unknown[]) => unknown>;
      for (const [name, fn] of Object.entries(fns)) {
        boundNs[name] = (...args: unknown[]) => fn(prng, ...args);
      }
      result[ns] = boundNs;
    }
    return result;
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
    parent?: Record<string, unknown>,
  ): GeneratorContext {
    const base: GeneratorContext = {
      prng: fieldPrng,
      gen: this.bindGenerators(fieldPrng),
      source,
      registry: this.registry,
      fieldPath,
      optionalProbability: this.options.optionalProbability ?? 0.2,
      related: <T>(relName: string): T => this.resolveRelated<T>(reg, recordPrng, relName),
    };
    return parent !== undefined ? { ...base, parent } : base;
  }

  // -------------------------------------------------------------------------
  // Private: relation resolution
  // -------------------------------------------------------------------------

  private resolveRelated<T>(reg: SchemaReg, recordPrng: ReturnType<typeof createPrng>, relName: string): T {
    const relSchema = reg.relations[relName];
    if (!relSchema) {
      throw new Error(`Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`);
    }

    if (this.registry.count(relSchema) === 0) {
      this.ensurePrimaryRecord(relSchema);
    }

    // Derive a stable per-relation PRNG so all fields in one record pick the same related entity.
    const relPrng = recordPrng.fork(`rel:${relName}`);
    const items = this.registry.all<T>(relSchema);
    return items[relPrng.int(0, items.length - 1)]!;
  }

  private ensurePrimaryRecord(schema: ZodTypeAny): void {
    if (this.registry.count(schema) > 0) return;
    const reg = this.findPrimaryRegs(schema)[0] ?? null;
    this.generateAndStorePrimary(schema, reg);
  }

  // -------------------------------------------------------------------------
  // Private: primary record generation
  // -------------------------------------------------------------------------

  private generateAndStorePrimary(schema: ZodTypeAny, reg: SchemaReg | null): unknown {
    const recordIndex = this.registry.count(schema);
    const effectiveRegId = reg?.regId ?? -1;
    const recordId = `reg${effectiveRegId}#${recordIndex}`;
    const recordPrng = createPrng(fieldSeed(this.options.seed, recordId, ""));
    const effectiveReg = reg ?? EMPTY_REG;
    const result = this.generateObjectFields(schema, effectiveReg, undefined, recordPrng, recordId);
    this.registry.store(schema, result);
    return result;
  }

  // -------------------------------------------------------------------------
  // Private: derived record generation
  // -------------------------------------------------------------------------

  private generateDerivedRecord(
    schema: ZodTypeAny,
    reg: SchemaReg,
    source: unknown,
    sourceIndex: number,
  ): unknown {
    const recordId = `dreg${reg.regId}#${sourceIndex}`;
    const recordPrng = createPrng(fieldSeed(this.options.seed, recordId, ""));
    return this.generateObjectFields(schema, reg, source, recordPrng, recordId);
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
    fieldPathPrefix: string,
  ): unknown {
    const d = def(schema);

    if (d.type !== "object") {
      return generateFromSchema(schema, this.makeFieldCtx(reg, source, recordPrng, recordPrng, fieldPathPrefix));
    }

    const shape = d.shape!;
    const result: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldPrng = recordPrng.fork(key);
      const fieldPath = fieldPathPrefix ? `${fieldPathPrefix}.${key}` : key;
      const fieldCtx = this.makeFieldCtx(reg, source, recordPrng, fieldPrng, fieldPath, result);

      // 1. Matcher
      const matcher = reg.matchers[key];
      if (matcher) {
        result[key] = matcher(fieldCtx);
        continue;
      }

      // 2. Per-schema key map
      const keyMapFn = this.schemaKeyMaps.get(schema)?.[key];
      if (keyMapFn !== undefined) {
        result[key] = keyMapFn(fieldCtx);
        continue;
      }

      // 3. Unwrap optional/nullable — roll for absence probability
      let innerSchema = fieldSchema as ZodTypeAny;
      let fd = def(innerSchema);
      let skip = false;

      while (fd.type === "optional" || fd.type === "nullable") {
        if (fieldCtx.prng.random() < (this.options.optionalProbability ?? 0.2)) {
          result[key] = fd.type === "optional" ? undefined : null;
          skip = true;
          break;
        }
        if (!fd.innerType) break;
        innerSchema = fd.innerType;
        fd = def(innerSchema);
      }
      if (skip) continue;

      // 4. Custom world-level key generator
      const customGen = this.customKeyGenerators.get(key.toLowerCase());
      if (customGen !== undefined) {
        result[key] = customGen(innerSchema, fieldCtx);
        continue;
      }

      // 5. Key-based heuristic generator
      const keyResult = generateFromKey(key, innerSchema, fieldCtx);
      if (keyResult !== undefined) {
        result[key] = keyResult;
        continue;
      }

      // 6. Schema-based generator
      result[key] = generateFromSchema(innerSchema, fieldCtx);
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
      const target = Math.max(existingCount, genPrng.int(
        Math.min(minRequired, maxAllowed),
        Math.max(minRequired, maxAllowed),
      ));

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
      if (c.check === "length_equals") { N = c.length!; maxN = N; break; }
      if (c.check === "min_length" && c.minimum !== undefined) N = Math.max(N, c.minimum);
      if (c.check === "max_length" && c.maximum !== undefined) maxN = Math.min(maxN, c.maximum);
    }
    N = genPrng.int(Math.min(N, maxN), Math.max(N, maxN));

    return Array.from({ length: N }, (_, i) => {
      const elemPrng = genPrng.fork(`[${i}]`);
      return generateFromSchema(innerSchema, this.makeFieldCtx(EMPTY_REG, undefined, elemPrng, elemPrng, `[${i}]`));
    });
  }

  // -------------------------------------------------------------------------
  // Private: single-item generation
  // -------------------------------------------------------------------------

  private generateSingleItem(schema: ZodTypeAny, options?: GenerateOptions<unknown>): unknown {
    this.generationCounter++;

    const derivedRegs = this.findDerivedRegs(schema);
    const primaryRegs = this.findPrimaryRegs(schema);

    let result: unknown;

    if (derivedRegs.length > 0) {
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
      result = this.generateDerivedRecord(schema, reg, source, sourceIndex);
    } else if (primaryRegs.length > 0) {
      result = this.generateAndStorePrimary(schema, primaryRegs[0]!);
    } else {
      // Ad-hoc
      const recordId = `adhoc-${this.generationCounter}`;
      const adHocPrng = this.prng.fork(recordId);
      const keyMap = this.schemaKeyMaps.get(schema);
      if (keyMap !== undefined && def(schema).type === "object") {
        result = this.generateObjectFields(schema, EMPTY_REG, undefined, adHocPrng, recordId);
      } else {
        result = generateFromSchema(schema, this.makeFieldCtx(EMPTY_REG, undefined, adHocPrng, adHocPrng, recordId));
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

export function createWorld(options: WorldOptions): World {
  return new WorldImpl(options);
}
