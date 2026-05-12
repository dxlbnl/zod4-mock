/**
 * schema-builder.ts
 * Converts PlaygroundState → real Zod schemas + a live World instance.
 * Used for the DataView live preview.
 */

import type { ZodTypeAny } from "zod";
import type { FieldDef, ModifierDef, PlaygroundState } from "./state.svelte";
import { createWorld as _createWorld } from "zod4-mock";

// ─── Field → Zod schema ───────────────────────────────────────────────────────

function applyModifiers(schema: ZodTypeAny, modifiers: ModifierDef[]): ZodTypeAny {
  let s = schema;
  for (const mod of modifiers) {
    const val = mod.value;
    const name = mod.name.replace(/\(\)$/, "");
    try {
      switch (name) {
        case ".min":
          if ("min" in s && typeof (s as any).min === "function") s = (s as any).min(Number(val));
          break;
        case ".max":
          if ("max" in s && typeof (s as any).max === "function") s = (s as any).max(Number(val));
          break;
        case ".length":
          if ("length" in s && typeof (s as any).length === "function")
            s = (s as any).length(Number(val));
          break;
        case ".int":
          if ("int" in s && typeof (s as any).int === "function") s = (s as any).int();
          break;
        case ".multipleOf":
          if ("multipleOf" in s && typeof (s as any).multipleOf === "function")
            s = (s as any).multipleOf(Number(val));
          break;
        case ".array":
          s = s.array();
          break;
        case ".optional":
          s = s.optional();
          break;
        case ".nullable":
          s = s.nullable();
          break;
        case ".default":
          s = s.default(val ?? "");
          break;
        case ".toLowerCase":
          if ("toLowerCase" in s && typeof (s as any).toLowerCase === "function")
            s = (s as any).toLowerCase();
          break;
        case ".toUpperCase":
          if ("toUpperCase" in s && typeof (s as any).toUpperCase === "function")
            s = (s as any).toUpperCase();
          break;
        case ".trim":
          if ("trim" in s && typeof (s as any).trim === "function") s = (s as any).trim();
          break;
        case ".startsWith":
          if ("startsWith" in s && typeof (s as any).startsWith === "function")
            s = (s as any).startsWith(String(val ?? ""));
          break;
        case ".endsWith":
          if ("endsWith" in s && typeof (s as any).endsWith === "function")
            s = (s as any).endsWith(String(val ?? ""));
          break;
      }
    } catch {
      // Silently skip invalid modifier application
    }
  }
  return s;
}

export function buildZodField(z: any, field: FieldDef): ZodTypeAny {
  let base: ZodTypeAny;

  switch (field.type) {
    case "string":
      base = z.string();
      break;
    case "number":
      base = z.number();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "date":
      base = z.date();
      break;
    case "uuid":
      base = z.uuid();
      break;
    case "email":
      base = z.email();
      break;
    case "url":
      base = z.url();
      break;
    case "enum":
      if (field.enumValues.length === 0) {
        base = z.string();
      } else {
        base = z.enum(field.enumValues as [string, ...string[]]);
      }
      break;
    case "object":
      if (field.children.length === 0) {
        base = z.object({});
      } else {
        const shape: Record<string, ZodTypeAny> = {};
        for (const child of field.children) {
          if (child.key) shape[child.key] = buildZodField(z, child);
        }
        base = z.object(shape);
      }
      break;
    default:
      base = z.unknown();
  }

  return applyModifiers(base, field.modifiers);
}

export function buildZodSchema(z: any, fields: FieldDef[]): any {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of fields) {
    if (!field.key) continue;
    shape[field.key] = buildZodField(z, field);
  }
  return z.object(shape);
}

// ─── PlaygroundState → World ──────────────────────────────────────────────────

export function buildWorld(state: PlaygroundState) {
  const schemaMap = new Map<string, ZodTypeAny>();

  let world = _createWorld({
    seed: state.world.seed,
    optionalProbability: state.world.optionalProbability,
    defaultArrayLength: [state.world.defaultArrayLengthMin, state.world.defaultArrayLengthMax],
  });

  // First pass: Build all Zod schemas
  for (const schemaDef of state.schemas) {
    const zSchema = buildZodSchema(state.z, schemaDef.fields);
    schemaMap.set(schemaDef.id, zSchema);
  }

  // Second pass: Register schemas with relations and matchers
  for (const schemaDef of state.schemas) {
    const zSchema = schemaMap.get(schemaDef.id)!;
    const opts: any = {};

    // Projections
    if (schemaDef.derivedFrom) {
      opts.from = schemaMap.get(schemaDef.derivedFrom);
    }

    // Relations
    if (schemaDef.relations.length > 0) {
      const relations: Record<string, ZodTypeAny> = {};
      for (const r of schemaDef.relations) {
        const target = schemaMap.get(r.targetSchemaId);
        if (target) relations[r.name] = target;
      }
      opts.relations = relations;
    }

    // Matchers
    const matchers: Record<string, any> = {};
    for (const f of schemaDef.fields) {
      if (schemaDef.derivedFrom && f.sourceMapping) {
        matchers[f.key] = (ctx: any) => ctx.source[f.sourceMapping!];
      } else if (f.relationMapping) {
        matchers[f.key] = (ctx: any) =>
          ctx.related(f.relationMapping!.relationName)[f.relationMapping!.targetFieldKey];
      }
    }
    if (Object.keys(matchers).length > 0) {
      opts.matchers = matchers;
    }

    world = world.withSchema(zSchema, opts);
  }

  // Populate
  for (const schemaDef of state.schemas) {
    if (schemaDef.populateCount > 0) {
      const zSchema = schemaMap.get(schemaDef.id)!;
      world = world.populate(zSchema, schemaDef.populateCount);
    }
  }

  return { world, schemaMap };
}

// ─── Generation Previews ──────────────────────────────────────────────────────

export interface GenerationResult {
  ok: boolean;
  data?: unknown[] | Record<string, unknown[]>;
  error?: string;
}

export function generateSchemaPreview(state: PlaygroundState, schemaId: string): GenerationResult {
  try {
    const { world, schemaMap } = buildWorld(state);
    const schema = schemaMap.get(schemaId);
    if (!schema) return { ok: false, error: "Schema not found" };

    const data = world.generate(state.z.array(schema).length(3)) as unknown[];
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function generateWorldData(state: PlaygroundState): GenerationResult {
  try {
    const { world, schemaMap } = buildWorld(state);
    const results: Record<string, unknown[]> = {};

    for (const schemaDef of state.schemas) {
      const schema = schemaMap.get(schemaDef.id);
      if (schema) {
        // If it's a "subject-like" schema (populateCount > 0), generate its registry content
        if (schemaDef.populateCount > 0) {
          results[schemaDef.name] = world.registry.all(schema) as unknown[];
        } else {
          // Otherwise generate some samples
          results[schemaDef.name] = world.generate(state.z.array(schema).length(3)) as unknown[];
        }
      }
    }
    return { ok: true, data: results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
