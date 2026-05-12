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

    case "template_literal":
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

    case "xor": {
      const pickLeft = prng.random() > 0.5;
      const chosen = pickLeft ? d.left : d.right;
      if (!chosen) return generateString(prng, 3, 10);
      return ctx.generate(chosen, { prng: ctx.prng.fork(pickLeft ? "l" : "r") });
    }

    case "optional": {
      if (prng.random() < optProb) return undefined;
      return ctx.generate(d.innerType!, ctx);
    }

    case "nullable": {
      if (prng.random() < optProb) return null;
      return ctx.generate(d.innerType!, ctx);
    }

    case "union": {
      // In Zod v4, discriminatedUnion is often typed as 'union' but with discriminator/optionsMap
      const dAny = d as any;
      if (dAny.discriminator && dAny.optionsMap && dAny.optionsMap.size > 0) {
        const keys = Array.from(dAny.optionsMap.keys());
        const randomKey = keys[prng.int(0, keys.length - 1)]!;
        const chosen = dAny.optionsMap.get(randomKey)!;
        return ctx.generate(chosen, ctx);
      }

      const options = d.options;
      if (!options || options.length === 0) {
        throw new Error("Unsupported schema: union missing options");
      }
      const chosen = options[prng.int(0, options.length - 1)]!;
      return ctx.generate(chosen, ctx);
    }

    case "intersection": {
      const left = ctx.generate(d.left!, ctx);
      const right = ctx.generate(d.right!, ctx);
      return deepMerge(left, right);
    }

    case "pipe": {
      const pipeIn = d.in;
      const pipeOut = d.out;

      if (!pipeIn || !pipeOut) {
        return generateString(prng, 3, 20);
      }

      const dIn = def(pipeIn);
      const dOut = def(pipeOut);

      // Zod v4 uses 'pipe' for effects (transform/preprocess).
      // If one side is a 'transform' tag, we have an effect.
      if (dOut.type === "transform") {
        // This is a transform (post-process).
        const input = ctx.generate(pipeIn, ctx);
        const transformFn = (dOut as any).transform;
        if (typeof transformFn === "function") {
          try {
            // Try to apply the transformation.
            const result = transformFn(input, { addIssue: () => {} });
            return result !== undefined ? result : input;
          } catch {
            return input;
          }
        }
        return input;
      }

      if (dIn.type === "transform") {
        // This is a preprocess (pre-process).
        // Since we can't easily invert a preprocessor, we generate the output type.
        return ctx.generate(pipeOut, ctx);
      }

      // If both are schemas, it's a real pipeline.
      // We prioritize the output side for generation to ensure the final
      // constraints of the pipe chain are satisfied.
      return ctx.generate(pipeOut, ctx);
    }

    case "default": {
      const optProb = ctx.optionalProbability ?? 0.2;
      if (prng.random() < optProb) {
        return typeof d.defaultValue === "function" ? d.defaultValue() : d.defaultValue;
      }
      return ctx.generate(d.innerType!, ctx);
    }
    case "catch":
      return ctx.generate(d.innerType!, ctx);
    case "readonly":
      return ctx.generate(d.innerType!, ctx);

    case "lazy":
      return ctx.generate(schema);

    case "promise":
      return undefined;

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
