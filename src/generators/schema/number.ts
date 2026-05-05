import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def, checks } from "./zod-def.js";

export function generateZodNumber(schema: ZodTypeAny, ctx: GeneratorContext): number {
  const prng = ctx.prng;
  const d = def(schema);
  let min = -1000;
  let max = 1000;
  let hasMin = false;
  let hasMax = false;
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
      min = (c.value as number) + (c.inclusive ? 0 : 1);
      hasMin = true;
    }
    if (c.check === "less_than") {
      max = (c.value as number) - (c.inclusive ? 0 : 1);
      hasMax = true;
    }
    if (c.check === "multiple_of") {
      multipleOf = c.value as number;
    }
  }

  if (hasMin && !hasMax) max = min + 2000;
  if (hasMax && !hasMin) min = max - 2000;

  if (multipleOf !== undefined) {
    const base = Math.ceil(min / multipleOf) * multipleOf;
    const count = Math.floor((max - base) / multipleOf);
    return base + prng.int(0, Math.max(0, count)) * multipleOf;
  }

  if (isInt) return prng.int(Math.ceil(min), Math.floor(max));
  return min + prng.random() * (max - min);
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
