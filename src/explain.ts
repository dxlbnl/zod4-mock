/**
 * @module explain
 *
 * B16 — read-only, PRNG-neutral introspection helper for `world.explain(schema)`.
 *
 * Mirrors the per-field decision pipeline in
 * `WorldImpl.generateObjectFields` WITHOUT invoking any generator: it reads
 * the registration map, the per-schema key map, the custom world-level key
 * generators, and the static `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS` to
 * report which step would resolve the field, plus a short reason.
 */

import type { ZodTypeAny } from "zod";
import { def, getLeafDef, resolveLazyChain } from "./generators/schema/zod-def.js";
import {
  DEFAULT_KEY_MAP,
  DEFAULT_KEY_PATTERNS,
} from "./generators/data/key-map.js";
import * as data from "./generators/data/index.js";
import type {
  ExplainResult,
  FieldExplanation,
  RelationExplanation,
} from "./types.js";

// ---------------------------------------------------------------------------
// Reverse lookup: PrngGen function reference → dotted "<namespace>.<fn>" id
// ---------------------------------------------------------------------------

const FN_TO_ID: Map<unknown, string> = (() => {
  const m = new Map<unknown, string>();
  // Stable namespace order so the first match wins for re-exports
  // (e.g. `location.postalCode` aliases `location.zipCode`).
  for (const [ns, mod] of Object.entries(data) as Array<
    [string, Record<string, unknown>]
  >) {
    if (!mod || typeof mod !== "object") continue;
    for (const [fnName, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      if (!m.has(fn)) m.set(fn, `${ns}.${fnName}`);
    }
  }
  return m;
})();

function identifierForExactKey(
  leafType: string,
  lowerKey: string,
): string | undefined {
  const map = DEFAULT_KEY_MAP[leafType];
  if (!map) return undefined;
  const fn = map[lowerKey];
  if (fn === undefined) return undefined;
  const id = FN_TO_ID.get(fn);
  if (id !== undefined) return id;
  // Inline closure (length-aware text, sku, accountnumber, etc.) — emit a
  // stable token. The spec (B16-R2 rule 4) pins this form.
  return `inline:${lowerKey}`;
}

// ---------------------------------------------------------------------------
// Pattern identification — first-match-wins, mirrors `generateFromKey`'s loop
// ---------------------------------------------------------------------------

interface PatternHit {
  identifier: string;
  label: string; // e.g. 'ends with "id"'
}

function patternHit(leafType: string, lowerKey: string): PatternHit | undefined {
  const patterns = DEFAULT_KEY_PATTERNS[leafType] ?? [];
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i]!;
    if (!p.test(lowerKey)) continue;
    return {
      identifier: patternIdentifier(leafType, i, lowerKey),
      label: patternLabel(leafType, i, lowerKey),
    };
  }
  return undefined;
}

function patternIdentifier(leafType: string, index: number, lowerKey: string): string {
  // Mirrors the literal pattern table in `DEFAULT_KEY_PATTERNS`. Indices are
  // stable for the shipped table.
  if (leafType === "string") {
    switch (index) {
      case 0:
        return "string.uuid"; // *id / *uuid / *guid / exactly "id"
      case 1:
        return "person.fullName"; // *name
      case 2:
        return "internet.url"; // *url / *link / url*
      case 3:
        return "internet.email"; // *email
      case 4:
        return "date.anytime+toISOString"; // *at / *date / date* / *_on
    }
  } else if (leafType === "date") {
    return "date.anytime";
  } else if (leafType === "number") {
    return "date.anytime+getTime";
  }
  // Fallback — keep the output stable even if the table grows. The literal
  // key is included to make debugging easy.
  return `pattern:${leafType}:${index}:${lowerKey}`;
}

function patternLabel(leafType: string, index: number, lowerKey: string): string {
  // Compute the human-readable label by inspecting the matching suffix /
  // prefix on the lowercased key, falling back to a stable per-rule string.
  if (leafType === "string") {
    if (index === 0) {
      if (lowerKey === "id" || lowerKey.endsWith("id")) return 'ends with "id"';
      if (lowerKey.endsWith("uuid")) return 'ends with "uuid"';
      if (lowerKey.endsWith("guid")) return 'ends with "guid"';
    }
    if (index === 1) return 'ends with "name"';
    if (index === 2) {
      if (lowerKey.endsWith("url")) return 'ends with "url"';
      if (lowerKey.endsWith("link")) return 'ends with "link"';
      if (lowerKey.startsWith("url")) return 'starts with "url"';
    }
    if (index === 3) return 'ends with "email"';
    if (index === 4) {
      if (lowerKey.endsWith("at")) return 'ends with "at"';
      if (lowerKey.endsWith("date")) return 'ends with "date"';
      if (lowerKey.startsWith("date")) return 'starts with "date"';
      if (lowerKey.endsWith("_on")) return 'ends with "_on"';
    }
  }
  if (leafType === "date" || leafType === "number") {
    if (lowerKey.endsWith("at")) return 'ends with "at"';
    if (lowerKey.endsWith("date")) return 'ends with "date"';
    if (lowerKey.startsWith("date")) return 'starts with "date"';
    if (lowerKey.endsWith("_on")) return 'ends with "_on"';
  }
  return `pattern:${leafType}:${lowerKey}`;
}

// ---------------------------------------------------------------------------
// Per-field decision
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

interface FieldDecision {
  generator: string;
  reason: string;
}

function decideField(
  fieldSchema: ZodTypeAny,
  key: string,
  inputs: ExplainInputs,
): FieldDecision {
  // Rule 1 — matcher
  if (Object.prototype.hasOwnProperty.call(inputs.matchers, key)) {
    return {
      generator: `matcher:${key}`,
      reason: "matcher registered via withSchema",
    };
  }

  // Rule 2 — per-schema key map
  if (Object.prototype.hasOwnProperty.call(inputs.schemaKeyMap, key)) {
    return {
      generator: `key-map:${key}`,
      reason: "per-schema key map registered via withKeyMap",
    };
  }

  // Rule 3 — world-level custom generator (case-insensitive)
  const lk = key.toLowerCase();
  if (inputs.customKeyGenerators.has(lk)) {
    return {
      generator: `custom:${lk}`,
      reason: "custom generator registered via withGenerators",
    };
  }

  // Rule 4 — exact-key in DEFAULT_KEY_MAP gated by leaf type
  const leaf = getLeafDef(fieldSchema);
  const leafType = leaf.type;
  const exact = identifierForExactKey(leafType, lk);
  if (exact !== undefined) {
    return {
      generator: exact,
      reason: `exact key: "${lk}"`,
    };
  }

  // Rule 5 — pattern match
  const hit = patternHit(leafType, lk);
  if (hit !== undefined) {
    return {
      generator: hit.identifier,
      reason: `key-pattern: ${hit.label}`,
    };
  }

  // Nested object / array — shallow summary
  if (leafType === "object" || leafType === "lazy") {
    return {
      generator: "schema-based:object",
      reason: "nested object — call explain(<FieldSchema>) for details",
    };
  }
  if (leafType === "array") {
    return {
      generator: "schema-based:array",
      reason: "array — element type explained on demand",
    };
  }

  // Rule 6 — schema-based fallback
  return {
    generator: "schema-based",
    reason: "no key match, no matcher",
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function explainSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  inputs: ExplainInputs,
): ExplainResult<TSchema> {
  // Mirror the unwrapping `WorldImpl.generate` does for the outer schema:
  // strip optional / nullable / lazy wrappers to reach an object.
  let current: ZodTypeAny = schema;
  let d = def(current);
  while (
    (d.type === "optional" || d.type === "nullable") &&
    d.innerType !== undefined
  ) {
    current = d.innerType;
    d = def(current);
  }
  current = resolveLazyChain(current);
  d = def(current);

  const fields: Record<string, FieldExplanation> = {};
  if (d.type === "object" && d.shape) {
    for (const [key, fieldSchema] of Object.entries(d.shape)) {
      const decision = decideField(fieldSchema, key, inputs);
      fields[key] = { generator: decision.generator, reason: decision.reason };
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
// toString formatter — aligned per-field table (B16-R7)
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
