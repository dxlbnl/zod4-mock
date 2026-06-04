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

const memoryBlockSchema = z.object({
  simple: memTierSchema,
  user: memTierSchema,
  nested: memTierSchema,
});

const versionEntrySchema = z.object({
  timestamp: z.string(),
  version: z.string(),
  avg_us: z.object({
    simple: z.number(),
    user: z.number(),
    nested: z.number(),
  }),
  memory: z.union([memoryBlockSchema, z.null()]),
  note: z.string().optional(),
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
  })
  .strict();

export type VersionsFile = z.infer<typeof versionsFileSchema>;
export type VersionEntry = z.infer<typeof versionEntrySchema>;
