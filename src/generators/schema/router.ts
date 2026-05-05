import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def } from "./zod-def.js";

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

export function generateFromSchema(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema);
  const prng = ctx.prng;
  const optProb = ctx.optionalProbability ?? 0.2;

  switch (d.type) {
    case "string":
      return generateZodString(schema, ctx);
    case "number":
      return generateZodNumber(schema, ctx);
    case "boolean":
      return prng.random() > 0.5;
    case "bigint":
      return generateZodBigInt(schema, ctx);
    case "symbol":
      return Symbol();
    case "nan":
      return NaN;
    case "never":
      return undefined;
    case "date":
      return generateZodDate(schema, ctx);

    case "enum": {
      const keys = Object.keys(d.entries!);
      return d.entries![keys[prng.int(0, keys.length - 1)]!];
    }

    case "literal":
      return d.values![0];

    case "templateLiteral":
      return generateTemplateLiteral(schema, ctx);

    case "tuple":
      return generateZodTuple(schema, ctx);
    case "record":
      return generateZodRecord(schema, ctx);
    case "map":
      return generateZodMap(schema, ctx);
    case "set":
      return generateZodSet(schema, ctx);
    case "object":
      return generateZodObject(schema, ctx);
    case "array":
      return generateZodArray(schema, ctx);

    case "intersection": {
      const left = generateFromSchema(d.left!, ctx) as Record<string, unknown>;
      const right = generateFromSchema(d.right!, {
        ...ctx,
        prng: ctx.prng.fork("right"),
      }) as Record<string, unknown>;
      return { ...left, ...right };
    }

    case "xor": {
      // If xor is implemented via left/right
      const pickLeft = prng.random() > 0.5;
      const chosen = pickLeft ? d.left : d.right;
      if (!chosen) return generateString(prng, 3, 10);
      return generateFromSchema(chosen, { ...ctx, prng: ctx.prng.fork(pickLeft ? "l" : "r") });
    }

    case "optional": {
      if (prng.random() < optProb) return undefined;
      return generateFromSchema(d.innerType!, ctx);
    }

    case "nullable": {
      if (prng.random() < optProb) return null;
      return generateFromSchema(d.innerType!, ctx);
    }

    case "union": {
      const options = d.options!;
      const chosen = options[prng.int(0, options.length - 1)]!;
      return generateFromSchema(chosen, ctx);
    }

    case "discriminatedUnion": {
      // In Zod, discriminated unions have optionsMap
      if (d.optionsMap) {
        const keys = Array.from(d.optionsMap.keys());
        const randomKey = keys[prng.int(0, keys.length - 1)]!;
        const chosen = d.optionsMap.get(randomKey)!;
        return generateFromSchema(chosen, ctx);
      } else if (d.options) {
        // Fallback if it has standard options array
        const chosen = d.options[prng.int(0, d.options.length - 1)]!;
        return generateFromSchema(chosen, ctx);
      }
      return generateString(prng, 3, 10);
    }

    case "default":
      return generateFromSchema(d.innerType!, ctx);
    case "catch":
      return generateFromSchema(d.innerType!, ctx);
    case "readonly":
      return generateFromSchema(d.innerType!, ctx);

    case "lazy": {
      const depth = (ctx.fieldPath ?? "").split(".").length;
      if (depth > 5) return null;
      return generateFromSchema(d.getter!(), ctx);
    }

    case "promise":
      return undefined;

    case "pipe": {
      const pipeIn = d.in;
      return pipeIn ? generateFromSchema(pipeIn, ctx) : generateString(prng, 3, 20);
    }

    case "json":
      return generateJson(ctx);

    case "null":
      return null;
    case "undefined":
      return undefined;
    case "void":
      return undefined;
    case "any":
    case "unknown":
      return generateString(prng, 3, 10);

    case "custom":
    case "function":
    case "instanceof":
    case "file":
      throw new UnsupportedSchemaError(d.type);

    default:
      return generateString(prng, 3, 10);
  }
}
