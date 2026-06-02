/**
 * @module world/registration
 *
 * Pure registration types and helpers extracted from `WorldImpl`.
 *
 * Concerns:
 *   - The internal `SchemaReg` record + its `NormalizedRelation` shape and the
 *     `EMPTY_REG` sentinel used by the ad-hoc / no-source-derived branches.
 *   - The `SchemaMode` tagged union returned by `resolveMode`.
 *   - `normalizeRelationEntry` + the `isZodSchema` predicate that backs the
 *     B11 discriminated `RelationEntry` union (bare schema vs `{ schema, where? }`).
 *   - The `findPrimaryRegs` / `findDerivedRegs` / `resolveMode` lookups over a
 *     `SchemaReg[]` array — `WorldImpl` keeps that array as a private field
 *     and threads it through these free helpers.
 *
 * These helpers are pure functions of their inputs (no `WorldImpl` access);
 * the class methods in `engine.ts` call them. Splitting them out keeps the
 * registration concern testable in isolation and trims the engine file.
 */

import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../types.js";

// ---------------------------------------------------------------------------
// Internal schema registration record
// ---------------------------------------------------------------------------

export interface NormalizedRelation {
  schema: ZodTypeAny;
  where: ((item: unknown) => boolean) | null;
}

export interface SchemaReg {
  schema: ZodTypeAny;
  from: ZodTypeAny | null;
  sourceKey: string | null;
  relations: Record<string, NormalizedRelation>;
  matchers: Record<string, (ctx: GeneratorContext) => unknown>;
  regId: number;
}

export const EMPTY_REG: SchemaReg = {
  schema: {} as ZodTypeAny,
  from: null,
  sourceKey: null,
  relations: {},
  matchers: {},
  regId: -1,
};

/**
 * B25 — internal discriminated union describing a schema's registration mode.
 * Returned by `resolveMode(schemaRegs, schema)`; consumed by the four
 * dispatchers (`generateSingleItem`, `generateArray`, `populate`'s explicit
 * primary-first variant, and `get`'s registered/not check). Not exported from
 * the package — internal to the `world/` subdirectory.
 */
export type SchemaMode =
  | { kind: "derived"; regs: SchemaReg[] }
  | { kind: "primary"; reg: SchemaReg }
  | { kind: "ad-hoc" };

/**
 * B11: discriminate the bare-schema form (`relations: { post: Schema }`)
 * from the object form (`relations: { post: { schema, where? } }`). An entry
 * is the object form when it is a non-Zod object carrying a `schema` property
 * whose value is itself a Zod schema. A `ZodTypeAny` carries its definition
 * at `_zod.def` — we use that brand to discriminate.
 */
export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === "object" && value !== null && "_zod" in (value as Record<string, unknown>)
  );
}

export function normalizeRelationEntry(entry: unknown): NormalizedRelation {
  if (isZodSchema(entry)) {
    return { schema: entry, where: null };
  }
  if (
    typeof entry === "object" &&
    entry !== null &&
    "schema" in (entry as Record<string, unknown>)
  ) {
    const obj = entry as { schema: unknown; where?: (item: unknown) => boolean };
    if (!isZodSchema(obj.schema)) {
      throw new Error("Invalid relations entry: `schema` must be a Zod schema reference.");
    }
    return { schema: obj.schema, where: obj.where ?? null };
  }
  throw new Error("Invalid relations entry: expected a Zod schema or `{ schema, where? }` object.");
}

// ---------------------------------------------------------------------------
// Registration lookups
// ---------------------------------------------------------------------------

export function findPrimaryRegs(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaReg[] {
  return schemaRegs.filter((r) => r.schema === schema && r.from === null);
}

export function findDerivedRegs(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaReg[] {
  return schemaRegs.filter((r) => r.schema === schema && r.from !== null);
}

/**
 * B25 — tagged-union resolution of a schema's registration mode. Replaces
 * the `findDerivedRegs(...).length > 0 ? ... : findPrimaryRegs(...).length > 0
 * ? ... : ad-hoc` cascade at the dispatcher sites.
 *
 * Derived-first precedence is uniform across all four dispatchers
 * (`generateSingleItem`, `generateArray`, `populate`, `get`) post-D12/B52 —
 * `withSchema` forbids dual primary+derived registration at registration
 * time, so the inversion-observable config can't exist and `populate`'s
 * former primary-first pre-check was removed. Operates on whatever schema
 * reference it is given — callers handle the two-level (`schema` then
 * `targetSchema`) fallback themselves where they need it.
 */
export function resolveMode(schemaRegs: readonly SchemaReg[], schema: ZodTypeAny): SchemaMode {
  const derivedRegs = findDerivedRegs(schemaRegs, schema);
  if (derivedRegs.length > 0) return { kind: "derived", regs: derivedRegs };
  const primaryRegs = findPrimaryRegs(schemaRegs, schema);
  if (primaryRegs.length > 0) return { kind: "primary", reg: primaryRegs[0]! };
  return { kind: "ad-hoc" };
}
