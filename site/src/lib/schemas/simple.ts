/**
 * B70 canonical `simple` tier — 4 plain primitive fields.
 *
 * Byte-equivalent to the inline `simple4` / `simple3` schemas that previously
 * lived in `site/bench/perf.test.ts`. The CLI perf-baseline
 * (`site/bench/results/baseline.json`) is pinned against this exact shape, so
 * the field names, field order, and absence of any check chain MUST be
 * preserved.
 */

import { z } from "zod";
import * as z3 from "zod3";

export const simple = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

export const simple3 = z3.object({
  id: z3.string(),
  name: z3.string(),
  age: z3.number(),
  active: z3.boolean(),
});

export type SimpleRecord = z.infer<typeof simple>;
