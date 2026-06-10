/**
 * @module explain
 *
 * Read-only, PRNG-neutral introspection helper for `world.explain(schema)`.
 *
 * Walks the same `PIPELINE` list as `WorldImpl.generateObjectFields` with
 * `dryRun: true`. Each step that would fire writes a `{ identifier, reason }`
 * pair into `ctx.explainMeta`, which this module renders into the
 * `FieldExplanation` shape. The per-rung decision logic lives in the seven
 * step bodies in `src/pipeline.ts` — no duplication here.
 */

import type { ZodTypeAny } from "zod";
import {
  def,
  getLeafDef,
  resolveLazyChain,
  stripOuterOptionalNullable,
} from "./generators/schema/zod-def.js";
import type {
  ExplainResult,
  FieldExplanation,
  GeneratorContext,
  KeyGenerator,
  RelationExplanation,
} from "./types.js";
import {
  PIPELINE,
  walkPipeline,
  EMPTY_SCHEMA_REG,
  type PipelineStepContext,
  type SchemaReg,
} from "./pipeline.js";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ExplainInputs {
  /** Matchers registered on the most recent `withSchema(...)` for this schema. */
  matchers: Record<string, unknown>;
  /** Per-schema key-map (registered via `withKeyMap`). */
  schemaKeyMap: Record<string, unknown>;
  /** World-level custom generators (registered via `withGenerators`). */
  customKeyGenerators: Map<string, unknown>;
  /** Normalised relations for the schema (name → { schema, where }). */
  relations: Record<string, { schema: ZodTypeAny; where: unknown }>;
}

export function explainSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  inputs: ExplainInputs,
): ExplainResult<TSchema> {
  // Mirror the unwrapping `WorldImpl.generate` does for the outer schema:
  // strip optional / nullable / lazy wrappers to reach an object.
  let current: ZodTypeAny = stripOuterOptionalNullable(schema).inner;
  current = resolveLazyChain(current);
  const d = def(current);

  const fields: Record<string, FieldExplanation> = {};
  if (d.type === "object" && d.shape) {
    // Build a per-call `SchemaReg` carrying the supplied matchers, and a
    // 1-entry schemaKeyMaps that the pipeline's dry-run branches consult.
    const reg: SchemaReg = {
      ...EMPTY_SCHEMA_REG,
      schema: current,
      matchers: inputs.matchers as Record<string, (ctx: GeneratorContext) => unknown>,
    };
    const schemaKeyMaps = new Map<ZodTypeAny, Record<string, (ctx: GeneratorContext) => unknown>>();
    schemaKeyMaps.set(
      current,
      inputs.schemaKeyMap as Record<string, (ctx: GeneratorContext) => unknown>,
    );
    const customKeyGenerators = inputs.customKeyGenerators as ReadonlyMap<string, KeyGenerator>;

    for (const [key, fieldSchema] of Object.entries(d.shape)) {
      const stepCtx: PipelineStepContext = {
        fieldSchema: fieldSchema as ZodTypeAny,
        fieldName: key,
        // Dry-run never invokes generators — the fieldCtx is a stub. Use `null`
        // through a cast for fields the dry-run path never reads.
        fieldCtx: undefined as unknown as GeneratorContext,
        fieldOverride: undefined,
        reg,
        outerSchema: schema,
        resolvedSchema: current,
        customKeyGenerators,
        schemaKeyMaps,
        optionalProbability: 0,
        dryRun: true,
        state: { inner: fieldSchema as ZodTypeAny },
        explainMeta: {},
      };
      walkPipeline(PIPELINE, stepCtx);
      // `explainMeta` is `{}` here because the dry-run path needs the
      // identifier/reason capture. The hot-path ctx in `engine.ts` uses
      // `null` instead and pipeline steps skip the writes — but on this
      // path the slot is always non-null.
      const meta = stepCtx.explainMeta;
      fields[key] = {
        generator: meta?.identifier ?? "schema-based",
        reason: meta?.reason ?? "no key match, no matcher",
      };
    }
  }

  const relations: Record<string, RelationExplanation> = {};
  for (const [relName, rel] of Object.entries(inputs.relations)) {
    relations[relName] = {
      schema: getLeafDef(rel.schema).type,
      where: rel.where ? "present" : "none",
    };
  }

  const result = {
    fields,
    relations,
    toString(): string {
      return formatExplainResult(fields, relations);
    },
  };
  return result as ExplainResult<TSchema>;
}

// ---------------------------------------------------------------------------
// toString formatter — aligned per-field table
// ---------------------------------------------------------------------------

function formatExplainResult(
  fields: Record<string, FieldExplanation>,
  relations: Record<string, RelationExplanation>,
): string {
  const keys = Object.keys(fields);
  let maxKey = 0;
  let maxGen = 0;
  for (const k of keys) {
    if (k.length > maxKey) maxKey = k.length;
    const g = fields[k]!.generator;
    if (g.length > maxGen) maxGen = g.length;
  }
  const lines: string[] = [];
  for (const k of keys) {
    const entry = fields[k]!;
    const paddedKey = k.padEnd(maxKey, " ");
    const paddedGen = entry.generator.padEnd(maxGen, " ");
    lines.push(`${paddedKey} → ${paddedGen} (${entry.reason})`);
  }
  const relKeys = Object.keys(relations);
  if (relKeys.length === 0) {
    return lines.join("\n");
  }
  const relLines = ["relations:"];
  for (const r of relKeys) {
    const entry = relations[r]!;
    relLines.push(`  ${r} → ${entry.schema}  (where: ${entry.where})`);
  }
  return [...lines, "", ...relLines].join("\n");
}
