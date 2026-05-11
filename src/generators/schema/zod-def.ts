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
  defaultValue?: () => unknown;
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

/** Applies formatting modifiers (case, trim, transform) to a value based on the schema. */
export function applyModifiers(value: unknown, schema: ZodTypeAny): unknown {
  const unwrapped = unwrap(schema);
  const d = def(unwrapped);

  if (d.type === "string" && typeof value === "string") {
    let result = value;
    const allChecks = checks(unwrapped);
    const overwrites: ZodCheck[] = [];
    const formats: ZodCheck[] = [];
    let min = 0;
    let max = Infinity;

    for (const c of allChecks) {
      if (c.check === "overwrite") overwrites.push(c);
      else if (c.check === "string_format") formats.push(c);
      else if (c.check === "min_length") min = Math.max(min, c.minimum!);
      else if (c.check === "max_length") max = Math.min(max, c.maximum!);
      else if (c.check === "length_equals") {
        min = c.length!;
        max = c.length!;
      }
    }

    // 1. Apply transformations that might affect content (including trim)
    for (const c of overwrites) {
      const tx = (c as unknown as { tx?: (v: string) => string }).tx;
      if (typeof tx === "function") result = tx(result);
    }

    // 2. Add required prefixes/suffixes/inclusions
    for (const c of formats) {
      if (c.format === "starts_with" && c.prefix) {
        if (!result.startsWith(c.prefix)) result = c.prefix + result;
      }
      if (c.format === "ends_with" && c.suffix) {
        if (!result.endsWith(c.suffix)) result = result + c.suffix;
      }
      if (c.format === "includes" && c.includes) {
        if (!result.includes(c.includes)) result = result + c.includes;
      }
    }

    // 3. Apply length bounds
    if (result.length < min) result = result.padEnd(min, "x");
    if (result.length > max) result = result.slice(0, max);

    // 4. Re-apply transformations to ensure final string (including padding) respects case
    for (const c of overwrites) {
      const tx = (c as unknown as { tx?: (v: string) => string }).tx;
      if (typeof tx === "function") result = tx(result);
    }

    return result;
  }

  if (d.type === "number" && typeof value === "number") {
    let result = value;
    const allChecks = checks(unwrapped);
    let isInt = false;
    let multipleOf: number | undefined;

    for (const c of allChecks) {
      if (c.check === "number_format") {
        isInt = c.format === "int" || c.format === "int32" || c.format === "safeint";
      }
      if (c.check === "multiple_of") {
        multipleOf = c.value as number;
      }
    }

    if (isInt) result = Math.floor(result);
    if (multipleOf !== undefined) {
      result = Math.round(result / multipleOf) * multipleOf;
    }

    return result;
  }

  return value;
}
