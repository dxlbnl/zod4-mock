import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../types.js";

export interface NormalizedRelation {
  schema: ZodTypeAny;
  where: ((item: unknown) => boolean) | null;
}

export interface SchemaReg {
  schema: ZodTypeAny;
  from: ZodTypeAny | null;
  sourceKey: string | null;
  relations: Record<string, NormalizedRelation>;
  matchers: Record<string, (ctx: GeneratorContext) => unknown>;
  regId: number;
}

export const EMPTY_REG: SchemaReg = {
  schema: {} as ZodTypeAny,
  from: null,
  sourceKey: null,
  relations: {},
  matchers: {},
  regId: -1,
};

export type SchemaMode =
  | { kind: "derived"; regs: SchemaReg[] }
  | { kind: "primary"; reg: SchemaReg }
  | { kind: "ad-hoc" };

export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === "object" && value !== null && "_zod" in (value as Record<string, unknown>)
  );
}

export function normalizeRelationEntry(entry: unknown): NormalizedRelation {
  if (isZodSchema(entry)) {
    return { schema: entry, where: null };
  }
  if (
    typeof entry === "object" &&
    entry !== null &&
    "schema" in (entry as Record<string, unknown>)
  ) {
    const obj = entry as { schema: unknown; where?: (item: unknown) => boolean };
    if (!isZodSchema(obj.schema)) {
      throw new Error("Invalid relations entry: `schema` must be a Zod schema reference.");
    }
    return { schema: obj.schema, where: obj.where ?? null };
  }
  throw new Error("Invalid relations entry: expected a Zod schema or `{ schema, where? }` object.");
}

export function findPrimaryRegs(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaReg[] {
  return schemaRegs.filter((r) => r.schema === schema && r.from === null);
}

export function findDerivedRegs(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaReg[] {
  return schemaRegs.filter((r) => r.schema === schema && r.from !== null);
}

// Derived-first precedence (withSchema forbids dual primary+derived registration).
export function resolveMode(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaMode {
  const derivedRegs = findDerivedRegs(schemaRegs, schema);
  if (derivedRegs.length > 0) return { kind: "derived", regs: derivedRegs };
  const primaryRegs = findPrimaryRegs(schemaRegs, schema);
  if (primaryRegs.length > 0) return { kind: "primary", reg: primaryRegs[0]! };
  return { kind: "ad-hoc" };
}
