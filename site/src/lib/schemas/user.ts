/**
 * B70 canonical `user` tier — 8 realistic fields.
 *
 * Byte-equivalent to the inline `user4` / `user3` schemas that previously
 * lived in `site/bench/perf.test.ts`. The CLI perf-baseline is pinned against
 * this exact shape; preserve field names, field order, and constraint chains.
 */

import { z } from "zod";
import * as z3 from "zod3";

export const user = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  age: z.int().gte(18).lte(100),
  role: z.enum(["admin", "user", "guest"]),
  bio: z.string().optional(),
  score: z.number().min(0).max(1),
});

export const user3 = z3.object({
  id: z3.string().uuid(),
  firstName: z3.string(),
  lastName: z3.string(),
  email: z3.string().email(),
  age: z3.number().int().min(18).max(100),
  role: z3.enum(["admin", "user", "guest"]),
  bio: z3.string().optional(),
  score: z3.number().min(0).max(1),
});

export type UserRecord = z.infer<typeof user>;
