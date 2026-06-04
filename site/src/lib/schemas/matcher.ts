/**
 * B70 canonical `matcher` tier — zod4-mock-only.
 *
 * The matcher tier exercises zod4-mock's relations + matchers API (a surface
 * that `@anatine/zod-mock` does not implement), so the canonical-naming
 * decision (spec B70-R2 scenario 3) carves it out as zod4-only — no zod3
 * parity export.
 *
 * Byte-equivalent to the inline schemas that previously lived in
 * `site/bench/perf.test.ts` (lines 161-180). The matcher-tier-shape grep test
 * pins the names `CompanySchema`, `UserSchema`, `fullName`, `email`, `city`,
 * `address`, `employerId` — preserved here so the import line into
 * `perf.test.ts` keeps the grep green.
 *
 * Note (B70-R7 open question §5): the matcher-tier `UserSchema` is PascalCase
 * to coexist with the ecommerce `userSchema` (camelCase). Both are re-exported
 * from `schemas/index.ts` without collision.
 */

import { z } from "zod";

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  industry: z.string(),
});

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  city: z.string(),
  address: AddressSchema,
  employerId: z.string().uuid(),
});
