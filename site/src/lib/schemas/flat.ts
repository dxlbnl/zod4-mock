import { z } from "zod";
import * as z3 from "zod3";

export const roleEnum = z.enum(["admin", "user", "moderator", "guest"]);
export const roleEnum3 = z3.enum(["admin", "user", "moderator", "guest"]);

export const flatSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(99),
  score: z.number().min(0).max(1),
  active: z.boolean(),
  createdAt: z.date(),
  role: roleEnum,
  bio: z.string().max(200),
  phone: z.string(),
});

export const flatSchema3 = z3.object({
  id: z3.string().uuid(),
  name: z3.string().min(2).max(50),
  email: z3.string().email(),
  age: z3.number().int().min(18).max(99),
  score: z3.number().min(0).max(1),
  active: z3.boolean(),
  createdAt: z3.date(),
  role: roleEnum3,
  bio: z3.string().max(200),
  phone: z3.string(),
});

export type FlatRecord = z.infer<typeof flatSchema>;
