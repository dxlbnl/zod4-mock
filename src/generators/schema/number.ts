import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def, checks } from "./zod-def.js";

export function resolveNumberBounds(
  schema: ZodTypeAny | undefined,
  defaultMin = -1000,
  defaultMax = 1000,
): { min: number; max: number; isInt: boolean; multipleOf?: number } {
  if (!schema) {
    return { min: defaultMin, max: defaultMax, isInt: false };
  }
  const d = def(schema);
  let min = defaultMin;
  let max = defaultMax;
  let hasSchemaMin = false;
  let hasSchemaMax = false;
  let isInt = false;
  let multipleOf: number | undefined;

  if (d.check === "number_format") {
    isInt = d.format === "safeint" || d.format === "int32";
  }

  for (const c of checks(schema)) {
    if (c.check === "number_format") {
      isInt = c.format === "safeint" || c.format === "int" || c.format === "int32";
    }
    if (c.check === "greater_than") {
      const val = (c.value as number) + (c.inclusive ? 0 : 1);
      min = hasSchemaMin ? Math.max(min, val) : val;
      hasSchemaMin = true;
    }
    if (c.check === "less_than") {
      const val = (c.value as number) - (c.inclusive ? 0 : 1);
      max = hasSchemaMax ? Math.min(max, val) : val;
      hasSchemaMax = true;
    }
    if (c.check === "multiple_of") {
      multipleOf = c.value as number;
    }
  }

  // If schema has a min but no max, and it exceeds our default max, push the max out.
  if (hasSchemaMin && !hasSchemaMax && min > max) {
    max = min + 1000;
  }
  // If schema has a max but no min, and it's below our default min, push the min down.
  if (hasSchemaMax && !hasSchemaMin && max < min) {
    min = max - 1000;
  }

  const result: { min: number; max: number; isInt: boolean; multipleOf?: number } = {
    min,
    max,
    isInt,
  };
  if (multipleOf !== undefined) result.multipleOf = multipleOf;

  return result;
}

export function generateNumberWithBounds(
  prng: GeneratorContext["prng"],
  bounds: { min: number; max: number; isInt: boolean; multipleOf?: number },
): number {
  const { min, max, isInt, multipleOf } = bounds;

  if (multipleOf !== undefined) {
    const base = Math.ceil(min / multipleOf) * multipleOf;
    const count = Math.floor((max - base) / multipleOf);
    return base + prng.int(0, Math.max(0, count)) * multipleOf;
  }

  if (isInt) return prng.int(Math.ceil(min), Math.floor(max));
  return min + prng.random() * (max - min);
}

export function generateZodNumber(schema: ZodTypeAny, ctx: GeneratorContext): number {
  return generateNumberWithBounds(ctx.prng, resolveNumberBounds(schema));
}

export function generateZodBigInt(schema: ZodTypeAny, ctx: GeneratorContext): bigint {
  const prng = ctx.prng;
  let min = BigInt(0);
  let max = BigInt(1000);

  for (const c of checks(schema)) {
    if (c.check === "greater_than") {
      const v = c.value as bigint;
      min = c.inclusive ? v : v + BigInt(1);
    }
    if (c.check === "less_than") {
      const v = c.value as bigint;
      max = c.inclusive ? v : v - BigInt(1);
    }
  }

  const range = max - min;
  if (range <= BigInt(0)) return min;
  const cap = range > BigInt(1_000_000) ? BigInt(1_000_000) : range;
  return min + BigInt(prng.int(0, Number(cap)));
}
