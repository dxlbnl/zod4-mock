import type { ZodTypeAny } from "zod";
import type { Prng } from "@zod4-mock/locale-core";

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
  out?: ZodTypeAny;
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

// Strips outer optional/nullable wrappers only (not default/readonly/catch/brand)
// to match the per-wrapper absent-roll semantics at the call sites.
export function stripOuterOptionalNullable(schema: ZodTypeAny): {
  inner: ZodTypeAny;
  wrappers: Array<"optional" | "nullable">;
} {
  let current = schema;
  let d = def(current);
  const wrappers: Array<"optional" | "nullable"> = [];
  while (d.innerType && (d.type === "optional" || d.type === "nullable")) {
    wrappers.push(d.type);
    current = d.innerType;
    d = def(current);
  }
  return { inner: current, wrappers };
}

// Walks z.lazy(...) to its resolved target. When a cache is supplied the getter
// result is memoized so the user's getter isn't called twice per outer lazy.
export function resolveLazyChain(
  schema: ZodTypeAny,
  cache?: WeakMap<ZodTypeAny, ZodTypeAny>,
): ZodTypeAny {
  let current = schema;
  let d = def(current);
  while (d.type === "lazy" && d.getter !== undefined) {
    let resolved = cache?.get(current);
    if (!resolved) {
      resolved = d.getter();
      cache?.set(current, resolved);
    }
    current = resolved;
    d = def(current);
  }
  return current;
}

// Walks the optional/nullable/default chain, rolling exactly one prng.random()
// per layer (so PRNG consumption is stable). With allowAbsent=false the roll still
// happens but the absent branch is never taken (a non-undefined override forces
// the field present while keeping PRNG state byte-identical).
export type UnwrappedAbsent = { kind: "skip" } | { kind: "default"; value: unknown };

export function unwrapOptionalChainForField(
  fieldSchema: ZodTypeAny,
  prng: Prng,
  optProb: number,
  allowAbsent: boolean = true,
): { inner: ZodTypeAny; absent: UnwrappedAbsent | null } {
  let inner = fieldSchema;
  let d = def(inner);
  let fallbackValue: unknown | undefined = undefined;
  let hasFallback = false;

  while (d.type === "optional" || d.type === "nullable" || d.type === "default") {
    const isAbsent = prng.random() < optProb;

    if (isAbsent && allowAbsent) {
      if (d.type === "default") {
        const value = typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
        return { inner, absent: { kind: "default", value } };
      }
      if (d.type === "optional") {
        return {
          inner,
          absent: hasFallback ? { kind: "default", value: fallbackValue } : { kind: "skip" },
        };
      }
      // d.type === "nullable"
      return { inner, absent: { kind: "default", value: null } };
    }

    if (d.type === "default") {
      fallbackValue = typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
      hasFallback = true;
    }

    if (!d.innerType) break;
    inner = d.innerType;
    d = def(inner);
  }

  return { inner, absent: null };
}

// String-modifier passes; the call order in applyStringModifiers is load-bearing
// (formatRefixPass restores prefixes/suffixes that lengthBoundsPass may have broken).
function runOverwriteTransforms(value: string, overwrites: ZodCheck[]): string {
  let result = value;
  for (const c of overwrites) {
    const tx = (c as unknown as { tx?: (v: string) => string }).tx;
    if (typeof tx === "function") result = tx(result);
  }
  return result;
}

function overwritePass(value: string, overwrites: ZodCheck[]): string {
  return runOverwriteTransforms(value, overwrites);
}

function formatAddPass(value: string, formats: ZodCheck[]): string {
  let result = value;
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
  return result;
}

function lengthBoundsPass(value: string, min: number, max: number): string {
  let result = value;
  if (result.length < min) result = result.padEnd(min, "x");
  if (result.length > max) result = result.slice(0, max);
  return result;
}

function formatRefixPass(value: string, formats: ZodCheck[]): string {
  // Restore start/end in place so the length computed by lengthBoundsPass is preserved.
  let result = value;
  for (const c of formats) {
    if (c.format === "starts_with" && c.prefix) {
      if (!result.startsWith(c.prefix)) {
        result = c.prefix + result.slice(c.prefix.length);
      }
    }
    if (c.format === "ends_with" && c.suffix) {
      if (!result.endsWith(c.suffix)) {
        const start = Math.max(0, result.length - c.suffix.length);
        result = result.slice(0, start) + c.suffix;
      }
    }
    if (c.format === "includes" && c.includes) {
      if (!result.includes(c.includes)) {
        // Squeeze into the middle — safer than appending if length is tight.
        const mid = Math.floor(result.length / 2);
        const start = Math.max(0, mid - Math.floor(c.includes.length / 2));
        result = result.slice(0, start) + c.includes + result.slice(start + c.includes.length);
      }
    }
  }
  return result;
}

function overwriteRefixPass(value: string, overwrites: ZodCheck[]): string {
  return runOverwriteTransforms(value, overwrites);
}

/** Runs the 5-stage string-modifier pipeline. */
export function applyStringModifiers(value: string, allChecks: ZodCheck[]): string {
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

  let result = value;
  result = overwritePass(result, overwrites);
  result = formatAddPass(result, formats);
  result = lengthBoundsPass(result, min, max);
  result = formatRefixPass(result, formats);
  result = overwriteRefixPass(result, overwrites);
  return result;
}

function intCoercePass(value: number, isInt: boolean): number {
  return isInt ? Math.floor(value) : value;
}

function multipleOfPass(value: number, multipleOf: number | undefined): number {
  if (multipleOf === undefined) return value;
  return Math.round(value / multipleOf) * multipleOf;
}

/** Runs the number-modifier pipeline. */
export function applyNumberModifiers(value: number, allChecks: ZodCheck[]): number {
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

  let result = value;
  result = intCoercePass(result, isInt);
  result = multipleOfPass(result, multipleOf);
  return result;
}

// Runtime type-routing dispatcher for callers that don't statically know whether
// the value is a string or number; typed callers may call the passes directly.
export function applyModifiers(value: unknown, schema: ZodTypeAny): unknown {
  const unwrapped = unwrap(schema);
  const d = def(unwrapped);

  if (d.type === "string" && typeof value === "string") {
    return applyStringModifiers(value, checks(unwrapped));
  }

  if (d.type === "number" && typeof value === "number") {
    return applyNumberModifiers(value, checks(unwrapped));
  }

  return value;
}
