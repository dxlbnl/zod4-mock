import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def, checks, applyModifiers } from "./zod-def.js";

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

export function generateZodArray(schema: ZodTypeAny, ctx: GeneratorContext): unknown[] {
  const d = def(schema);
  const [defMin, defMax] = [1, 5];
  const length = resolveArrayLength(schema, defMin, defMax, ctx.prng);
  return Array.from({ length }, (_, i) =>
    ctx.generate(d.element!, {
      prng: ctx.prng.fork(`el-${i}`),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${i}` : `${i}`,
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

import { generateFromKey } from "../data/key-map.js";

export function generateZodObject(
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): Record<string, unknown> {
  const d = def(schema);
  const shape = d.shape!;
  const result: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const childCtx: GeneratorContext = {
      ...ctx,
      prng: ctx.prng.fork(key),
      fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : key,
      current: result as Record<string, unknown>,
    };

    // Unwrap optional/nullable so key-based generators see the inner schema,
    // and handle the absent-value probability here rather than deep inside
    // generateFromSchema where the field key is no longer available.
    let innerSchema = fieldSchema;
    let d = def(innerSchema);
    let skip = false;

    let fallbackValue: unknown | undefined = undefined;
    let hasFallback = false;

    while (d.type === "optional" || d.type === "nullable" || d.type === "default") {
      const isAbsent = childCtx.prng.random() < (ctx.optionalProbability ?? 0.2);

      if (isAbsent) {
        if (d.type === "default") {
          result[key] = typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
        } else if (d.type === "optional") {
          result[key] = hasFallback ? fallbackValue : undefined;
        } else if (d.type === "nullable") {
          result[key] = null;
        }
        skip = true;
        break;
      }

      if (d.type === "default") {
        fallbackValue = typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
        hasFallback = true;
      }

      if (!d.innerType) break;
      innerSchema = d.innerType;
      d = def(innerSchema);
    }

    if (skip) continue;

    // Try key-based heuristics first
    const keyResult = generateFromKey(key, innerSchema, childCtx);
    result[key] =
      keyResult !== undefined
        ? applyModifiers(keyResult, innerSchema)
        : childCtx.generate(innerSchema);
  }
  return result;
}
