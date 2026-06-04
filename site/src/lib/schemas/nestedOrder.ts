/**
 * B70 canonical `nestedOrder` tier — browser demo's 3-level order shape.
 *
 * This is the schema that previously lived in `site/src/lib/schemas/nested.ts`
 * as `nestedSchema` / `nestedSchema3`. Renamed to `nestedOrder` so it doesn't
 * collide with the CLI `nested` (mixed-features stress shape) that the perf
 * baseline is pinned against (spec B70-R7).
 *
 * Used by the browser `/bench` segmented control; preserves the customer →
 * address richness the original demo had.
 */

import { z } from "zod";
import * as z3 from "zod3";

export const nestedOrder = z.object({
  id: z.string().uuid(),
  total: z.number().min(0),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string(),
    }),
  }),
});

export const nestedOrder3 = z3.object({
  id: z3.string().uuid(),
  total: z3.number().min(0),
  status: z3.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  customer: z3.object({
    id: z3.string().uuid(),
    name: z3.string(),
    email: z3.string().email(),
    address: z3.object({
      street: z3.string(),
      city: z3.string(),
      state: z3.string(),
      zip: z3.string(),
      country: z3.string(),
    }),
  }),
});

export type NestedOrderRecord = z.infer<typeof nestedOrder>;
