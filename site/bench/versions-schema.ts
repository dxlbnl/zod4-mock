/**
 * B98-R1 — Zod schema for site/bench/results/versions.json.
 *
 * Pins the on-disk shape so a contributor can't silently break the file
 * format. Used by versions-schema.test.ts and (potentially) by the
 * regression generator (regression.bench.ts).
 */

import { z } from "zod";

const memTierSchema = z.object({
  heapUsedDeltaBytes: z.number(),
  v8HeapUsedBytes: z.number(),
  gcForced: z.boolean(),
});

// B97-R9: `matcher` tier added alongside simple / user / nested. Each per-row
// `matcher` value is `MemTier | null` — null is the legacy carveout for
// historical aliases whose API can't run the matcher-tier registration shape
// (mirrors B98-R1's per-row `memory: null` carveout).
const memoryBlockSchema = z.object({
  simple: memTierSchema,
  user: memTierSchema,
  nested: memTierSchema,
  matcher: z.union([memTierSchema, z.null()]).optional(),
});

const versionEntrySchema = z.object({
  timestamp: z.string(),
  version: z.string(),
  avg_us: z.object({
    simple: z.number(),
    user: z.number(),
    nested: z.number(),
    // B97-R9: matcher number for the post-B97 entries; null is the legacy
    // carveout for rows where the historical alias doesn't support the
    // matcher tier (a `note` explains the incompatibility per R10).
    matcher: z.union([z.number(), z.null()]).optional(),
  }),
  memory: z.union([memoryBlockSchema, z.null()]),
  note: z.string().optional(),
});

// B71-R7 fallback: top-level marker recording bench-methodology changes
// (e.g. fixed-runs → time-budget switch). Historical `entries` keep their
// original `config` semantics; this marker documents prospective changes
// for traceability.
const methodologyChangeSchema = z.object({
  date: z.string(),
  by: z.string(),
  from: z.object({ warmup: z.number(), runs: z.number() }).optional(),
  to: z
    .object({
      warmup: z.number(),
      budgetMs: z.number(),
      maxRuns: z.number(),
      matcherWarmup: z.number().optional(),
      matcherBudgetMs: z.number().optional(),
    })
    .optional(),
  rationale: z.string(),
});

export const versionsFileSchema = z
  .object({
    _doc: z.string(),
    config: z.object({
      warmup: z.number(),
      runs: z.number(),
    }),
    node: z.string(),
    schemas: z.object({
      simple: z.string(),
      user: z.string(),
      nested: z.string(),
    }),
    entries: z.array(versionEntrySchema),
    methodologyChanges: z.array(methodologyChangeSchema).optional(),
  })
  .strict();

export type VersionsFile = z.infer<typeof versionsFileSchema>;
export type VersionEntry = z.infer<typeof versionEntrySchema>;
