import { generateMock } from "@anatine/zod-mock";
import type { ZodTypeAny } from "zod";
import { simple3 } from "../schemas/simple";
import { nestedOrder3 } from "../schemas/nestedOrder";
import { array3 } from "../schemas/array";

type SchemaKey = "simple" | "nestedOrder" | "array";

// zod3 schemas are structurally identical to zod4's ZodTypeAny at the call site;
// the peer mismatch is a package-resolution artifact, not a runtime issue.
const g = (schema: unknown) => generateMock(schema as ZodTypeAny);
const generators: Record<SchemaKey, () => unknown> = {
  simple: () => g(simple3),
  nestedOrder: () => g(nestedOrder3),
  array: () => g(array3),
};

export const runZodMock = {
  simple: () => generators.simple(),
  nestedOrder: () => generators.nestedOrder(),
  array: () => generators.array(),
  batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema]),
};
