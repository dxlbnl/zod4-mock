/**
 * B70 canonical `array` tier — 50-element variant array.
 *
 * Renamed from `arraySchema` to `array` (and `arraySchema3` → `array3`) for
 * naming consistency with the rest of the canonical set (spec B70-R7 + open
 * question §3). Shape is preserved (`.length(50)` constraint intact).
 */

import { z } from "zod";
import * as z3 from "zod3";

const variantItem = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  color: z.string(),
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  stock: z.number().int().min(0),
  price: z.number().min(0),
});

const variantItem3 = z3.object({
  id: z3.string().uuid(),
  sku: z3.string(),
  color: z3.string(),
  size: z3.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  stock: z3.number().int().min(0),
  price: z3.number().min(0),
});

export const array = z.array(variantItem).length(50);
export const array3 = z3.array(variantItem3).length(50);

export type ArrayRecord = z.infer<typeof array>;
