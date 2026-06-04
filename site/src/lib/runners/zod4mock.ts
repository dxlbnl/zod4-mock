import { generate } from "zod4-mock";
import { simple } from "../schemas/simple";
import { nestedOrder } from "../schemas/nestedOrder";
import { array } from "../schemas/array";

type SchemaKey = "simple" | "nestedOrder" | "array";

const generators: Record<SchemaKey, () => unknown> = {
  simple: () => generate(simple),
  nestedOrder: () => generate(nestedOrder),
  array: () => generate(array),
};

export const runZod4Mock = {
  simple: () => generators.simple(),
  nestedOrder: () => generators.nestedOrder(),
  array: () => generators.array(),
  batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema]),
};
