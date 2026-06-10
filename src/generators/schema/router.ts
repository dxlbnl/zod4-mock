import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def } from "./zod-def.js";
import type { ZodDef } from "./zod-def.js";

import { generateZodString, generateTemplateLiteral, generateString } from "./string.js";
import { generateZodNumber, generateZodBigInt } from "./number.js";
import { generateZodDate } from "./date.js";
import {
  generateZodArray,
  generateZodTuple,
  generateZodRecord,
  generateZodMap,
  generateZodSet,
  generateZodObject,
} from "./collection.js";
import { deepMerge } from "../../utils/merge.js";

export class UnsupportedSchemaError extends Error {
  constructor(type: string) {
    super(
      `zod4-mock cannot generically mock the '${type}' schema type. Please provide a custom Matcher or KeyGenerator for this field.`,
    );
  }
}

function generateJson(ctx: GeneratorContext, depth = 0): unknown {
  if (depth > 3)
    return ctx.prng.random() > 0.5 ? generateString(ctx.prng, 3, 10) : ctx.prng.int(1, 100);
  const types = ["string", "number", "boolean", "null", "array", "object"];
  const t = types[ctx.prng.int(0, types.length - 1)];
  switch (t) {
    case "string":
      return generateString(ctx.prng, 3, 10);
    case "number":
      return ctx.prng.int(-1000, 1000);
    case "boolean":
      return ctx.prng.random() > 0.5;
    case "null":
      return null;
    case "array":
      return Array.from({ length: ctx.prng.int(1, 3) }, (_, i) =>
        generateJson({ ...ctx, prng: ctx.prng.fork(`a${i}`) }, depth + 1),
      );
    case "object":
      return {
        [generateString(ctx.prng, 3, 6)]: generateJson(
          { ...ctx, prng: ctx.prng.fork("o") },
          depth + 1,
        ),
      };
  }
}

// Locally enumerated (Zod v4 types def.type as `string`) so the
// Record<ZodDefType, GenFn> typing turns a missing DISPATCH entry into a compile error.
type ZodDefType =
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "symbol"
  | "nan"
  | "never"
  | "date"
  | "enum"
  | "literal"
  | "template_literal"
  | "tuple"
  | "record"
  | "map"
  | "set"
  | "object"
  | "array"
  | "xor"
  | "optional"
  | "nullable"
  | "union"
  | "intersection"
  | "pipe"
  | "default"
  | "catch"
  | "readonly"
  | "lazy"
  | "promise"
  | "json"
  | "null"
  | "undefined"
  | "void"
  | "any"
  | "unknown"
  | "custom"
  | "function"
  | "instanceof"
  | "file";

type GenFn = (schema: ZodTypeAny, ctx: GeneratorContext) => unknown;

function generateXor(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const prng = ctx.prng;
  const pickLeft = prng.random() > 0.5;
  const chosen = pickLeft ? d.left : d.right;
  if (!chosen) return generateString(prng, 3, 10);
  return ctx.generate(chosen, { prng: ctx.prng.fork(pickLeft ? "l" : "r") });
}

function generateUnion(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const prng = ctx.prng;
  // Zod v4 types discriminatedUnion as 'union' with discriminator/optionsMap (not
  // on the shared ZodDef); read them off a local view.
  const dWithDiscriminator = d as ZodDef & {
    discriminator?: string;
    optionsMap?: Map<unknown, ZodTypeAny>;
  };
  const optionsMap = dWithDiscriminator.optionsMap;
  if (dWithDiscriminator.discriminator && optionsMap && optionsMap.size > 0) {
    const keys = Array.from(optionsMap.keys());
    const randomKey = keys[prng.int(0, keys.length - 1)]!;
    const chosen = optionsMap.get(randomKey)!;
    return ctx.generate(chosen, ctx);
  }

  const options = d.options;
  if (!options || options.length === 0) {
    throw new Error("Unsupported schema: union missing options");
  }
  const chosen = options[prng.int(0, options.length - 1)]!;
  return ctx.generate(chosen, ctx);
}

function generateIntersection(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const left = ctx.generate(d.left!, ctx);
  const right = ctx.generate(d.right!, ctx);
  return deepMerge(left, right);
}

function generatePipe(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const prng = ctx.prng;
  const pipeIn = d.in;
  const pipeOut = d.out;

  if (!pipeIn || !pipeOut) {
    return generateString(prng, 3, 20);
  }

  const dIn = def(pipeIn);
  const dOut = def(pipeOut);

  // Zod v4 models effects (transform/preprocess) as a 'pipe'.
  if (dOut.type === "transform") {
    const input = ctx.generate(pipeIn, ctx);
    const transformFn = (
      dOut as ZodDef & { transform?: (v: unknown, c: { addIssue: () => void }) => unknown }
    ).transform;
    if (typeof transformFn === "function") {
      try {
        const result = transformFn(input, { addIssue: () => {} });
        return result !== undefined ? result : input;
      } catch {
        return input;
      }
    }
    return input;
  }

  // A preprocessor can't be inverted, so generate the output type. Real pipelines
  // also prioritise the output side so the chain's final constraints are satisfied.
  if (dIn.type === "transform") {
    return ctx.generate(pipeOut, ctx);
  }

  return ctx.generate(pipeOut, ctx);
}

function generateOptional(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const optProb = ctx.optionalProbability ?? 0.2;
  if (ctx.prng.random() < optProb) return undefined;
  return ctx.generate(d.innerType!, ctx);
}

function generateNullable(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const optProb = ctx.optionalProbability ?? 0.2;
  if (ctx.prng.random() < optProb) return null;
  return ctx.generate(d.innerType!, ctx);
}

function generateDefault(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const optProb = ctx.optionalProbability ?? 0.2;
  if (ctx.prng.random() < optProb) {
    return typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
  }
  return ctx.generate(d.innerType!, ctx);
}

function generateInnerType(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  return ctx.generate(def(schema).innerType!, ctx);
}

function generateEnum(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const keys = Object.keys(d.entries!);
  return d.entries![keys[ctx.prng.int(0, keys.length - 1)]!];
}

function generateUnsupported(schema: ZodTypeAny): never {
  throw new UnsupportedSchemaError(def(schema).type);
}

function generateFallbackString(_schema: ZodTypeAny, ctx: GeneratorContext): string {
  return generateString(ctx.prng, 3, 10);
}

const DISPATCH: Record<ZodDefType, GenFn> = {
  string: (s, ctx) => generateZodString(s, ctx),
  number: (s, ctx) => generateZodNumber(s, ctx),
  boolean: (_s, ctx) => ctx.prng.random() > 0.5,
  bigint: (s, ctx) => generateZodBigInt(s, ctx),
  symbol: () => Symbol(),
  nan: () => NaN,
  never: () => undefined,
  date: (s, ctx) => generateZodDate(s, ctx),
  enum: generateEnum,
  literal: (s) => def(s).values![0],
  template_literal: (s, ctx) => generateTemplateLiteral(s, ctx),
  tuple: (s, ctx) => generateZodTuple(s, ctx),
  record: (s, ctx) => generateZodRecord(s, ctx),
  map: (s, ctx) => generateZodMap(s, ctx),
  set: (s, ctx) => generateZodSet(s, ctx),
  object: (s, ctx) => generateZodObject(s, ctx),
  array: (s, ctx) => generateZodArray(s, ctx),
  xor: generateXor,
  optional: generateOptional,
  nullable: generateNullable,
  union: generateUnion,
  intersection: generateIntersection,
  pipe: generatePipe,
  default: generateDefault,
  catch: generateInnerType,
  readonly: generateInnerType,
  lazy: (s, ctx) => ctx.generate(s),
  promise: () => undefined,
  json: (_s, ctx) => generateJson(ctx),
  null: () => null,
  undefined: () => undefined,
  void: () => undefined,
  any: generateFallbackString,
  unknown: generateFallbackString,
  custom: generateUnsupported,
  function: generateUnsupported,
  instanceof: generateUnsupported,
  file: generateUnsupported,
};

// The pipeline's always-resolving final rung: a value from Zod type introspection.
export function generateFromSchema(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const handler = (DISPATCH as Record<string, GenFn | undefined>)[d.type];
  if (handler !== undefined) return handler(schema, ctx);
  return generateString(ctx.prng, 3, 10);
}
