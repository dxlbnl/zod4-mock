import type { ZodTypeAny } from "zod";
import type { GeneratorContext, KeyGenerator, Prng } from "../../types.js";
import { def, checks } from "./zod-def.js";
import { createPrng, fnv1a, splitmix32 } from "../../prng.js";
import {
  PIPELINE_NO_REGISTRATION,
  walkPipeline,
  EMPTY_SCHEMA_REG,
  type PipelineStepContext,
} from "../../pipeline.js";

export function resolveArrayLength(
  schema: ZodTypeAny,
  defaultMin: number,
  defaultMax: number,
  prng: GeneratorContext["prng"],
): number {
  let min = defaultMin;
  let max = defaultMax;
  let exact: number | undefined;

  for (const c of checks(schema)) {
    if (c.check === "length_equals") exact = c.length!;
    if (c.check === "min_length") min = Math.max(min, c.minimum!);
    if (c.check === "max_length") max = Math.min(max, c.maximum!);
  }

  if (exact !== undefined) return exact;
  return prng.int(Math.min(min, max), Math.max(min, max));
}

// Pre-computes per-field base seeds once for a ZodObject inner schema, then
// derives per-element field seeds via XOR+splitmix — no string allocation per element.
function createBatchElementPrng(baseSeeds: Record<string, number>, elementSeed: number): Prng {
  const inner = createPrng(elementSeed);
  return {
    seed: elementSeed,
    random: () => inner.random(),
    int: (min, max) => inner.int(min, max),
    pick: (items) => inner.pick(items),
    pickZipf: (items, s) => inner.pickZipf(items, s),
    logUniform: (min, max) => inner.logUniform(min, max),
    geometric: (p) => inner.geometric(p),
    shuffle: (items) => inner.shuffle(items),
    sample: (items, count) => inner.sample(items, count),
    bytes: (n) => inner.bytes(n),
    fork(key: string): Prng {
      const base = baseSeeds[key];
      return base !== undefined
        ? createPrng(base ^ elementSeed)
        : createPrng(fnv1a(`${elementSeed}:${key}`));
    },
  };
}

export function generateZodArray(schema: ZodTypeAny, ctx: GeneratorContext): unknown[] {
  const d = def(schema);
  const [defMin, defMax] = ctx.defaultArrayLength ?? [1, 5];
  // When an array `options.overrides` value targets this field array, the
  // override length sets the element count — it wins even over `.length(N)` /
  // `.min` / `.max` / `defaultArrayLength`, which govern only the no-override
  // case. The per-element seeding loop below then runs `0..override.length-1`,
  // so the bases stay per-element distinct and store-neutral.
  const length = ctx.overrideArrayLength ?? resolveArrayLength(schema, defMin, defMax, ctx.prng);

  // An array of a REGISTERED-primary element runs each element through
  // `ctx.generate(element)`, which resolves to the engine's registered-primary
  // record path. Under `store: false` that path's default `registry.count +
  // pending` seed index self-cancels (writes suppressed, `pending` cycles 0→1→0)
  // so every element collapses to `reg<id>#<existingCount>` → identical records.
  // Thread an explicit per-element `recordIndex` (`existingCount + i`) so the
  // i-th element seeds distinctly — identical to the store-on path, where the
  // count advances by one per stored element. For unregistered element schemas
  // the engine ignores `recordIndex`, so this is inert there.
  const elementExistingCount = ctx.registry.count(d.element!);

  const innerDef = def(d.element!);
  if (innerDef.type === "object" && innerDef.shape) {
    const parentSeed = ctx.prng.seed;
    const baseSeeds: Record<string, number> = {};
    for (const f of Object.keys(innerDef.shape)) {
      baseSeeds[f] = fnv1a(`${parentSeed}:${f}`);
    }
    return Array.from({ length }, (_, i) => {
      const elementSeed = splitmix32(parentSeed ^ (i + 1));
      return ctx.generate(d.element!, {
        prng: createBatchElementPrng(baseSeeds, elementSeed),
        fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${i}` : `${i}`,
        recordIndex: elementExistingCount + i,
      });
    });
  }

  return Array.from({ length }, (_, i) =>
    ctx.generate(d.element!, {
      prng: ctx.prng.fork(`el-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${i}` : `${i}`,
      recordIndex: elementExistingCount + i,
    }),
  );
}

export function generateZodTuple(schema: ZodTypeAny, ctx: GeneratorContext): unknown[] {
  const d = def(schema);
  const items = d.items ?? [];
  const result = items.map((item, i) =>
    ctx.generate(item, {
      prng: ctx.prng.fork(`t-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${i}` : `${i}`,
    }),
  );
  if (d.rest) {
    const restCount = ctx.prng.int(0, 3);
    for (let i = 0; i < restCount; i++) {
      result.push(
        ctx.generate(d.rest, {
          prng: ctx.prng.fork(`tr-${i}`),
          fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${items.length + i}` : `${items.length + i}`,
        }),
      );
    }
  }
  return result;
}

export function generateZodRecord(
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): Record<string, unknown> {
  const d = def(schema);

  // Finite-key path — when keyType is z.enum([...]), Zod v4 makes the
  // record strict-keyed over the enum's member set, so emit exactly one entry
  // per enum member in declared order. Per-key value PRNG is forked by index
  // (`rv-${i}`) so appending an enum member only disturbs the new member's
  // value. Empty enum → {} naturally (loop body never runs).
  const keyDef = def(d.keyType!);
  if (keyDef.type === "enum") {
    const enumValues = Object.values(keyDef.entries ?? {});
    const result: Record<string, unknown> = {};
    for (const [i, key] of enumValues.entries()) {
      result[key] = ctx.generate(d.valueType!, {
        prng: ctx.prng.fork(`rv-${i}`),
        fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : key,
      });
    }
    return result;
  }

  // Open-key path (z.record(z.string()/z.number(), V)): unchanged byte-for-byte.
  const count = ctx.prng.int(2, 5);
  const result: Record<string, unknown> = {};
  for (let i = 0; i < count; i++) {
    const rawKey = ctx.generate(d.keyType!, {
      prng: ctx.prng.fork(`rk-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.<key:${i}>` : `<key:${i}>`,
    });

    // Ensure key is a string and not "[object Object]"
    let key: string;
    if (typeof rawKey === "object" && rawKey !== null) {
      key = JSON.stringify(rawKey);
    } else {
      key = String(rawKey);
    }

    result[key] = ctx.generate(d.valueType!, {
      prng: ctx.prng.fork(`rv-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : key,
    });
  }
  return result;
}

export function generateZodMap(schema: ZodTypeAny, ctx: GeneratorContext): Map<unknown, unknown> {
  const d = def(schema);
  const count = ctx.prng.int(2, 4);
  const result = new Map<unknown, unknown>();
  for (let i = 0; i < count; i++) {
    const key = ctx.generate(d.keyType!, {
      prng: ctx.prng.fork(`mk-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.<key:${i}>` : `<key:${i}>`,
    });
    const val = ctx.generate(d.valueType!, {
      prng: ctx.prng.fork(`mv-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : String(key),
    });
    result.set(key, val);
  }
  return result;
}

export function generateZodSet(schema: ZodTypeAny, ctx: GeneratorContext): Set<unknown> {
  const d = def(schema);
  let min = 1;
  let max = 4;
  for (const c of checks(schema)) {
    if (c.check === "min_size") min = Math.max(min, c.minimum!);
    if (c.check === "max_size") max = Math.min(max, c.maximum!);
  }
  const size = ctx.prng.int(Math.min(min, max), Math.max(min, max));

  const result = new Set<unknown>();
  let attempts = 0;
  const maxAttempts = size * 10;

  while (result.size < size && attempts < maxAttempts) {
    result.add(
      ctx.generate(d.valueType!, {
        prng: ctx.prng.fork(`sv-${attempts}`),
        fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${result.size}` : `${result.size}`,
      }),
    );
    attempts++;
  }
  return result;
}

/**
 * Walks the same `PIPELINE_NO_REGISTRATION` subset
 * (unwrapOptional → keyHeuristic → schemaBased) as `WorldImpl.generateObjectFields`
 * does for the registration-free path. The four omitted rungs (override,
 * matcher, schemaKeyMap, customKeyGen) are explicitly absent because this
 * nested-`z.object` entry path has no `SchemaReg` available.
 */
export function generateZodObject(
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): Record<string, unknown> {
  const d = def(schema);
  const shape = d.shape!;
  const result: Record<string, unknown> = {};
  const emptyCustomKeyGenerators: ReadonlyMap<string, KeyGenerator> = new Map();
  const emptySchemaKeyMaps: ReadonlyMap<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  > = new Map();

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const childCtx: GeneratorContext = {
      ...ctx,
      prng: ctx.prng.fork(key),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : key,
      current: result as Record<string, unknown>,
    };
    const stepCtx: PipelineStepContext = {
      fieldSchema,
      fieldName: key,
      fieldCtx: childCtx,
      fieldOverride: undefined,
      reg: EMPTY_SCHEMA_REG,
      outerSchema: schema,
      resolvedSchema: schema,
      customKeyGenerators: emptyCustomKeyGenerators,
      schemaKeyMaps: emptySchemaKeyMaps,
      optionalProbability: ctx.optionalProbability ?? 0.2,
      dryRun: false,
      state: { inner: fieldSchema },
      explainMeta: {},
    };
    const r = walkPipeline(PIPELINE_NO_REGISTRATION, stepCtx);
    result[key] = r.value;
  }
  return result;
}
