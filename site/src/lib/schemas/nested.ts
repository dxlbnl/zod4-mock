/**
 * B70 canonical `nested` tier — CLI mixed-features shape.
 *
 * Byte-equivalent to the inline `nested4` / `nested3` schemas that previously
 * lived in `site/bench/perf.test.ts`. Seven top-level fields:
 *   id (uuid), name, email, address (inner object), billingAddress (optional
 *   address), tags (array), metadata (record).
 *
 * The companion `address` / `address3` are exported so consumers (the CLI
 * matcher tests, the bench harness) can re-use the same reference identity
 * (D4 / D10).
 */

import { z } from "zod";
import * as z3 from "zod3";

export const address = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  zip: z.string(),
});

export const address3 = z3.object({
  street: z3.string(),
  city: z3.string(),
  country: z3.string(),
  zip: z3.string(),
});

export const nested = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  address,
  billingAddress: address.optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.string()),
});

export const nested3 = z3.object({
  id: z3.string().uuid(),
  name: z3.string(),
  email: z3.string().email(),
  address: address3,
  billingAddress: address3.optional(),
  tags: z3.array(z3.string()),
  metadata: z3.record(z3.string()),
});

export type NestedRecord = z.infer<typeof nested>;
