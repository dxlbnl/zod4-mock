import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { checks } from "./zod-def.js";

export function generateZodDate(schema: ZodTypeAny, ctx: GeneratorContext): Date {
  const prng = ctx.prng;
  let minMs = new Date("2020-01-01").getTime();
  let maxMs = new Date("2025-12-31").getTime();
  for (const c of checks(schema)) {
    if (c.check === "greater_than") {
      minMs = (c.value as Date).getTime() + (c.inclusive ? 0 : 1);
    }
    if (c.check === "less_than") {
      maxMs = (c.value as Date).getTime() - (c.inclusive ? 0 : 1);
    }
  }
  return new Date(minMs + prng.random() * (maxMs - minMs));
}
