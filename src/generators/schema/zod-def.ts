import type { ZodTypeAny } from "zod";

export interface ZodDef {
  type: string;
  check?: string;
  format?: string;
  shape?: Record<string, ZodTypeAny>;
  element?: ZodTypeAny;
  entries?: Record<string, string>;
  values?: unknown[];
  innerType?: ZodTypeAny;
  options?: ZodTypeAny[];
  optionsMap?: Map<string | number | symbol, ZodTypeAny>; // for discriminated union
  discriminator?: string;
  in?: ZodTypeAny;
  items?: ZodTypeAny[];
  rest?: ZodTypeAny;
  keyType?: ZodTypeAny;
  valueType?: ZodTypeAny;
  left?: ZodTypeAny;
  right?: ZodTypeAny;
  getter?: () => ZodTypeAny;
  checks?: ZodCheck[];
}

export interface ZodCheck {
  check: string;
  minimum?: number;
  maximum?: number;
  length?: number;
  value?: unknown;
  inclusive?: boolean;
  format?: string;
  prefix?: string;
  suffix?: string;
  includes?: string;
  pattern?: RegExp;
}

export function def(schema: ZodTypeAny): ZodDef {
  return (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
}

export function checks(schema: ZodTypeAny): ZodCheck[] {
  const raw = def(schema).checks as Array<{ _zod: { def: ZodCheck } }> | undefined;
  return (raw ?? []).map((c) => c._zod.def);
}

/** Recursively unwraps modifiers like .optional(), .nullable(), .default(), etc. */
export function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;
  let d = def(current);
  while (
    d.type === "optional" ||
    d.type === "nullable" ||
    d.type === "default" ||
    d.type === "readonly" ||
    d.type === "catch" ||
    d.type === "brand"
  ) {
    if (!d.innerType) break;
    current = d.innerType;
    d = def(current);
  }
  return current;
}

/** Unwraps the schema and returns its core ZodDef. */
export function getLeafDef(schema: ZodTypeAny): ZodDef {
  return def(unwrap(schema));
}
