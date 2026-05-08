/**
 * schema-builder.ts
 * Converts PlaygroundState → real Zod schemas + a live World instance.
 * Used for the DataView live preview.
 */

import type { ZodTypeAny } from "zod";
import type { FieldDef, ModifierDef, PlaygroundState } from "./state.svelte";
import { defineSubjectType, createWorld as _createWorld } from "zod4-mock";

// ─── Field → Zod schema ───────────────────────────────────────────────────────

function applyModifiers(schema: ZodTypeAny, modifiers: ModifierDef[]): ZodTypeAny {
  let s = schema;
  for (const mod of modifiers) {
    const val = mod.value;
    const name = mod.name.replace(/\(\)$/, ""); // strip trailing ()
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
        base = z.string(); // fallback
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
    case "array":
      base = z.array(z.unknown());
      break;
    default:
      base = z.unknown();
  }

  return applyModifiers(base, field.modifiers);
}

export function buildZodSchema(z: any, fields: FieldDef[]): ReturnType<typeof z.object> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of fields) {
    if (!field.key) continue;
    shape[field.key] = buildZodField(z, field);
  }
  return z.object(shape);
}

// ─── PlaygroundState → World ──────────────────────────────────────────────────

export function buildWorld(state: PlaygroundState) {
  const subjectMap = new Map<string, ReturnType<typeof defineSubjectType>>();
  const schemaMap = new Map<string, ZodTypeAny>();

  let world = _createWorld({
    seed: state.world.seed,
    optionalProbability: state.world.optionalProbability,
    defaultArrayLength: [state.world.defaultArrayLengthMin, state.world.defaultArrayLengthMax],
  });

  // Register subjects
  for (const subj of state.subjects) {
    const schema = buildZodSchema(state.z, subj.fields);

    // Find relations for this subject
    const subjectRelations = state.relationships.filter((r) => r.from === subj.name);
    const relations: Record<string, any> = {};
    const derive: Record<string, any> = {};

    for (const rel of subjectRelations) {
      relations[rel.relationName] = { type: rel.to, cardinality: rel.cardinality };

      // Auto-derive foreign key fields if they exist in the schema
      // Pattern: relationName + "Id" (e.g., customerId) or "userId" if relation is "customer" and target is "User"
      const targetSubj = state.subjects.find((s) => s.name === rel.to);
      const possibleKeys = [
        rel.relationName,
        rel.relationName + "Id",
        rel.relationName + "_id",
        (targetSubj?.name || "") + "Id",
        (targetSubj?.name || "") + "_id",
      ].map((k) => k.toLowerCase());

      for (const field of subj.fields) {
        if (field.key && possibleKeys.includes(field.key.toLowerCase())) {
          derive[field.key] = (s: any, ctx: any) => {
            const related = ctx.related(rel.relationName);
            if (Array.isArray(related)) {
              // Return array of IDs for 0..n or 1..n
              return related.map((r: any) => r.id);
            }
            // Return single ID for 1 or 0..1
            return related?.id;
          };
        }
      }
    }

    const subjectType = defineSubjectType(subj.name, schema, { relations, derive });
    subjectMap.set(subj.id, subjectType);
    schemaMap.set(subj.id, schema);
    world = world.withSubject(subjectType) as typeof world;
    // Register the subject's own schema so world.generate(z.array(schema)) pulls from the registry
    world = world.withSchema(schema, subjectType) as typeof world;
  }

  // Register schemas with bindings
  for (const schemaDef of state.schemas) {
    const apiSchema = buildZodSchema(state.z, schemaDef.fields);
    schemaMap.set(schemaDef.id, apiSchema);

    const binding = state.bindings.find((b) => b.schemaId === schemaDef.id);
    if (!binding) {
      // Even if no binding, register the schema so world.generate(apiSchema) works ad-hoc
      continue;
    }
    const subjectType = subjectMap.get(binding.subjectId);
    if (!subjectType) continue;

    // Build matchers from fieldMap
    const matchers: Record<string, (s: Record<string, unknown>, ctx: any) => unknown> = {};
    for (const [schemaKey, subjectKey] of Object.entries(binding.fieldMap)) {
      matchers[schemaKey] = (s) => s[subjectKey];
    }

    world = world.withSchema(apiSchema, subjectType, matchers as any) as typeof world;
  }

  // Populate subjects
  for (const subj of state.subjects) {
    const subjectType = subjectMap.get(subj.id);
    if (subjectType && subj.count > 0) {
      world = world.populate(subjectType, subj.count) as typeof world;
    }
  }

  return { world, subjectMap, schemaMap };
}

// ─── Generate preview data for a subject ─────────────────────────────────────

export interface GenerationResult {
  ok: boolean;
  data?: unknown[] | Record<string, unknown[]>;
  error?: string;
}

export function generateSubjectData(state: PlaygroundState, subjectId: string): GenerationResult {
  try {
    const subj = state.subjects.find((s) => s.id === subjectId);
    if (!subj) return { ok: false, error: "Subject not found" };

    const { world, schemaMap } = buildWorld(state);
    const schema = schemaMap.get(subjectId);
    if (!schema) return { ok: false, error: "Subject schema not found" };

    const data = world.generate(state.z.array(schema)) as unknown[];
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function generateWorldData(state: PlaygroundState): GenerationResult {
  try {
    const { world, schemaMap } = buildWorld(state);
    const results: Record<string, unknown[]> = {};

    // Generate for all subjects
    for (const subj of state.subjects) {
      const schema = schemaMap.get(subj.id);
      if (schema) {
        results[subj.name] = world.generate(state.z.array(schema)) as unknown[];
      }
    }

    // Generate for all schemas
    for (const schemaDef of state.schemas) {
      const schema = schemaMap.get(schemaDef.id);
      if (schema) {
        results[schemaDef.name] = world.generate(state.z.array(schema).length(3)) as unknown[];
      }
    }

    return { ok: true, data: results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

