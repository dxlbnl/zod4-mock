import { z } from "zod";
import * as z3 from "zod3";

export const nestedSchema = z.object({
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

export const nestedSchema3 = z3.object({
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

export type NestedRecord = z.infer<typeof nestedSchema>;
