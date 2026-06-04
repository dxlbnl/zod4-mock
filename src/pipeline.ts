/**
 * @module pipeline
 *
 * B23 — the per-field generation pipeline, promoted from a flat `for` body
 * with 7 inline rungs in `WorldImpl.generateObjectFields` to a `PIPELINE`
 * list of named `PipelineStep` functions returning a `FieldResolution`
 * tagged union.
 *
 * The same list powers three call sites:
 *   - `WorldImpl.generateObjectFields` walks `PIPELINE` per field;
 *   - `explainSchema` (in `src/explain.ts`) walks `PIPELINE` with
 *     `dryRun: true` for read-only inspection;
 *   - `generateZodObject` (in `src/generators/schema/collection.ts`) walks
 *     `PIPELINE_NO_REGISTRATION` — a 3-step subset omitting the four
 *     registration-dependent rungs.
 *
 * PRNG fork keys, deep-merge contracts (B12 / B18), and absent-roll
 * semantics are preserved byte-identically — see B23-R5 / B23-R6.
 */

import type { ZodTypeAny } from "zod";
import type { GeneratorContext, KeyGenerator } from "./types.js";
import {
  def,
  unwrap,
  applyModifiers,
  unwrapOptionalChainForField,
} from "./generators/schema/zod-def.js";
import { generateFromSchema } from "./generators/schema/index.js";
import {
  generateFromKey,
  DEFAULT_KEY_MAP,
  DEFAULT_KEY_PATTERNS,
} from "./generators/data/key-map.js";
import * as data from "./generators/data/index.js";
import { deepMerge } from "./utils/merge.js";

// ---------------------------------------------------------------------------
// SchemaReg — re-exported shape carried by the pipeline context
//
// Mirrors the internal interface in `world.ts`. Only `matchers` is read by
// the pipeline itself; `from` / `sourceKey` / `relations` / `regId` are
// kept here so the same record can be threaded through.
// ---------------------------------------------------------------------------

export interface SchemaReg {
  readonly schema: ZodTypeAny;
  readonly from: ZodTypeAny | null;
  readonly sourceKey: string | null;
  readonly relations: Record<
    string,
    { schema: ZodTypeAny; where: ((item: unknown) => boolean) | null }
  >;
  readonly matchers: Record<string, (ctx: GeneratorContext) => unknown>;
  readonly regId: number;
}

export const EMPTY_SCHEMA_REG: SchemaReg = {
  schema: {} as ZodTypeAny,
  from: null,
  sourceKey: null,
  relations: {},
  matchers: {},
  regId: -1,
};

// ---------------------------------------------------------------------------
// FieldResolution — tagged union returned by a pipeline step
// ---------------------------------------------------------------------------

export type FieldResolution =
  | { kind: "override"; value: unknown }
  | { kind: "matcher"; value: unknown }
  | { kind: "keymap"; value: unknown }
  | { kind: "absent"; value: undefined | null }
  | { kind: "default"; value: unknown }
  | { kind: "custom-gen"; value: unknown }
  | { kind: "key-based"; value: unknown }
  | { kind: "schema-based"; value: unknown };

// ---------------------------------------------------------------------------
// PipelineStepContext — per-field context built by `walkPipeline` callers
// ---------------------------------------------------------------------------

/**
 * Mutable side-channel used by `unwrapOptionalStep` to communicate the
 * unwrapped inner schema to downstream steps. The context reference itself
 * is readonly on `PipelineStepContext`, but the slot inside it is mutated
 * by step 3 before falling through to steps 4-6.
 */
export interface PipelineState {
  inner: ZodTypeAny;
}

export interface PipelineStepContext {
  /** The field's Zod schema (pre-unwrap-optional). */
  readonly fieldSchema: ZodTypeAny;
  /** The field name (the property key on the Zod object's shape). */
  readonly fieldName: string;
  /** The field's `GeneratorContext` — carries `prng`, `gen`, `source`, etc. */
  readonly fieldCtx: GeneratorContext;
  /** Pre-extracted override slice for this field (`overrides?.[key]`). */
  readonly fieldOverride: unknown;
  /** Registration record for the outer (registered) schema; `EMPTY_SCHEMA_REG` for ad-hoc. */
  readonly reg: SchemaReg;
  /** The outer object schema reference (used by `schemaKeyMapStep`'s two-level lookup). */
  readonly outerSchema: ZodTypeAny;
  /** Lazy-resolved schema for the same lookup. */
  readonly resolvedSchema: ZodTypeAny;
  /** World-level custom key generators (registered via `withGenerators`). */
  readonly customKeyGenerators: ReadonlyMap<string, KeyGenerator>;
  /** Per-schema key maps (registered via `withKeyMap`). */
  readonly schemaKeyMaps: ReadonlyMap<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  >;
  /** Optional-roll probability (`world.options.optionalProbability ?? 0.2`). */
  readonly optionalProbability: number;
  /**
   * Read-only dry-run flag. When `true`, steps MUST NOT execute side-effects
   * (no PRNG draws, no `applyModifiers`, no generator invocations). Steps
   * report the resolution they would produce as a `FieldResolution` with
   * `value: undefined`; the `explainSchema` walk consumes the `kind` field
   * and the `meta` slot (for keyHeuristicStep's identifier/reason).
   */
  readonly dryRun: boolean;
  /** Mutable slot for the unwrapped inner schema (written by step 3, read by 4-6). */
  readonly state: PipelineState;
  /**
   * Mutable slot for explain-mode metadata (rendered identifier + reason).
   *
   * B97: on the hot generate() path this is `null` so the per-field ctx
   * literal stores one slot instead of allocating a nested `{}`. Pipeline
   * steps that write to `explainMeta` MUST null-check first; only the
   * `explain()` path in `src/explain.ts` constructs a `{}` and reads the
   * captured identifier/reason.
   */
  readonly explainMeta: { identifier?: string; reason?: string } | null;
}

export type PipelineStep = (ctx: PipelineStepContext) => FieldResolution | null;

// ---------------------------------------------------------------------------
// B12 deep-merge helper
//
// Applies a plain-object override on top of a step's matcher / keymap /
// custom-gen result. Primitive/array overrides were consumed by step 0
// (`overrideEagerStep`); reaching here means `fieldOverride` is either
// `undefined` or a plain object. `deepMerge` is B18-safe (atomic-object
// guarded in `src/utils/merge.ts`).
// ---------------------------------------------------------------------------

export function applyObjectOverride(value: unknown, fieldOverride: unknown): unknown {
  if (fieldOverride === undefined) return value;
  return deepMerge(value, fieldOverride);
}

// ---------------------------------------------------------------------------
// Explain-mode helpers — pin the rendered `generator` and `reason` strings
// when a step fires under `dryRun: true`. Live here (not `explain.ts`) so
// the per-rung decision logic has exactly one home.
// ---------------------------------------------------------------------------

/**
 * Reverse-lookup map: PrngGen function reference → dotted `<namespace>.<fn>` id.
 * Built once at module load; mirrors `explain.ts`'s pre-B23 `FN_TO_ID`.
 */
const FN_TO_ID: Map<unknown, string> = (() => {
  const m = new Map<unknown, string>();
  for (const [ns, mod] of Object.entries(data) as Array<[string, Record<string, unknown>]>) {
    if (!mod || typeof mod !== "object") continue;
    for (const [fnName, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      if (!m.has(fn)) m.set(fn, `${ns}.${fnName}`);
    }
  }
  return m;
})();

function identifierForExactKey(leafType: string, lowerKey: string): string | undefined {
  const map = DEFAULT_KEY_MAP[leafType];
  if (!map) return undefined;
  const fn = map[lowerKey];
  if (fn === undefined) return undefined;
  const id = FN_TO_ID.get(fn);
  if (id !== undefined) return id;
  return `inline:${lowerKey}`;
}

interface PatternHit {
  identifier: string;
  label: string;
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
  if (leafType === "string") {
    switch (index) {
      case 0:
        return "string.uuid";
      case 1:
        return "person.fullName";
      case 2:
        return "internet.url";
      case 3:
        return "internet.email";
      case 4:
        return "date.anytime+toISOString";
    }
  } else if (leafType === "date") {
    return "date.anytime";
  } else if (leafType === "number") {
    return "date.anytime+getTime";
  }
  return `pattern:${leafType}:${index}:${lowerKey}`;
}

function patternLabel(leafType: string, index: number, lowerKey: string): string {
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
// Pipeline steps
// ---------------------------------------------------------------------------

// Step 0 — eager primitive/array override.
export function overrideEagerStep(ctx: PipelineStepContext): FieldResolution | null {
  const o = ctx.fieldOverride;
  if (o === undefined) return null;
  if (typeof o !== "object" || o === null || Array.isArray(o)) {
    // Dry-run: explain-mode emits no `kind: "override"` identifier (B16's
    // pre-B23 behaviour did not surface overrides). Reaching this branch under
    // `dryRun: true` would require user-supplied `overrides` in `explain()`,
    // which the explain API does not accept — so it's effectively unreachable.
    // For safety, still return the resolution so future explain callers see it.
    return { kind: "override", value: o };
  }
  return null;
}

// Step 1 — matcher registered via `withSchema`.
export function matcherStep(ctx: PipelineStepContext): FieldResolution | null {
  const m = ctx.reg.matchers[ctx.fieldName];
  if (!m) return null;
  if (ctx.dryRun) {
    if (ctx.explainMeta !== null) {
      ctx.explainMeta.identifier = `matcher:${ctx.fieldName}`;
      ctx.explainMeta.reason = "matcher registered via withSchema";
    }
    return { kind: "matcher", value: undefined };
  }
  const matched = m(ctx.fieldCtx);
  return {
    kind: "matcher",
    value: applyObjectOverride(matched, ctx.fieldOverride),
  };
}

// Step 2 — per-schema key map registered via `withKeyMap`.
export function schemaKeyMapStep(ctx: PipelineStepContext): FieldResolution | null {
  // Pre-B23 dry-run path: explain consulted only the schemaKeyMap directly
  // (via `world.explain`'s `schemaKeyMap` shortlist for the outer schema).
  // For byte-identical explain output, the dry-run branch checks the lookup
  // by name on the supplied (post-merge) map, not the two-level outer/inner.
  if (ctx.dryRun) {
    // The `schemaKeyMaps` Map carries one entry: the merged record built by
    // `explainSchema`'s caller. Read whichever key matches.
    for (const map of ctx.schemaKeyMaps.values()) {
      if (Object.prototype.hasOwnProperty.call(map, ctx.fieldName)) {
        if (ctx.explainMeta !== null) {
          ctx.explainMeta.identifier = `key-map:${ctx.fieldName}`;
          ctx.explainMeta.reason = "per-schema key map registered via withKeyMap";
        }
        return { kind: "keymap", value: undefined };
      }
    }
    return null;
  }
  const fn =
    ctx.schemaKeyMaps.get(ctx.outerSchema)?.[ctx.fieldName] ??
    ctx.schemaKeyMaps.get(ctx.resolvedSchema)?.[ctx.fieldName];
  if (fn === undefined) return null;
  const mapped = fn(ctx.fieldCtx);
  return {
    kind: "keymap",
    value: applyObjectOverride(mapped, ctx.fieldOverride),
  };
}

// Step 3 — unwrap optional/nullable/default, rolling for absence.
export function unwrapOptionalStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
    // Explain-mode: do not consume PRNG state. The unwrap is purely static —
    // we just need `state.inner` populated for the next steps. Walk the
    // wrapper chain without rolling. No `kind: "absent"` / `"default"` is
    // emitted (pre-B23 explain reported a non-absent decision for
    // optional/nullable fields — B16-R8).
    let inner = ctx.fieldSchema;
    let d = def(inner);
    while (
      (d.type === "optional" || d.type === "nullable" || d.type === "default") &&
      d.innerType
    ) {
      inner = d.innerType;
      d = def(inner);
    }
    ctx.state.inner = inner;
    return null;
  }
  const { inner, absent } = unwrapOptionalChainForField(
    ctx.fieldSchema,
    ctx.fieldCtx.prng,
    ctx.optionalProbability,
    ctx.fieldOverride === undefined,
  );
  ctx.state.inner = inner;
  if (absent !== null) {
    if (absent.kind === "skip") {
      return { kind: "absent", value: undefined };
    }
    return { kind: "default", value: absent.value };
  }
  return null;
}

// Step 4 — world-level custom key generator (case-insensitive).
export function customKeyGenStep(ctx: PipelineStepContext): FieldResolution | null {
  const lk = ctx.fieldName.toLowerCase();
  const customGen = ctx.customKeyGenerators.get(lk);
  if (customGen === undefined) return null;
  if (ctx.dryRun) {
    if (ctx.explainMeta !== null) {
      ctx.explainMeta.identifier = `custom:${lk}`;
      ctx.explainMeta.reason = "custom generator registered via withGenerators";
    }
    return { kind: "custom-gen", value: undefined };
  }
  const innerSchema = ctx.state.inner;
  const val = applyModifiers(customGen(innerSchema, ctx.fieldCtx), innerSchema);
  return {
    kind: "custom-gen",
    value: applyObjectOverride(val, ctx.fieldOverride),
  };
}

// Step 5 — DEFAULT_KEY_MAP / DEFAULT_KEY_PATTERNS heuristic.
export function keyHeuristicStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
    // Pre-B23 explain consulted the wrapped fieldSchema (not the inner) for
    // its leaf type — getLeafDef unwraps internally. Use the inner if step 3
    // set it (it does, since unwrapOptionalStep precedes this), else
    // fieldSchema. Both unwrap to the same leaf via getLeafDef.
    const inner = ctx.state.inner;
    const leafType = def(unwrap(inner)).type;
    const lk = ctx.fieldName.toLowerCase();
    const exact = identifierForExactKey(leafType, lk);
    if (exact !== undefined) {
      if (ctx.explainMeta !== null) {
        ctx.explainMeta.identifier = exact;
        ctx.explainMeta.reason = `exact key: "${lk}"`;
      }
      return { kind: "key-based", value: undefined };
    }
    const hit = patternHit(leafType, lk);
    if (hit !== undefined) {
      if (ctx.explainMeta !== null) {
        ctx.explainMeta.identifier = hit.identifier;
        ctx.explainMeta.reason = `key-pattern: ${hit.label}`;
      }
      return { kind: "key-based", value: undefined };
    }
    return null;
  }
  const innerSchema = ctx.state.inner;
  const keyResult = generateFromKey(ctx.fieldName, innerSchema, ctx.fieldCtx);
  if (keyResult === undefined) return null;
  // Today's contract: key-based step's fieldOverride **replaces** the result
  // (not deep-merge). Preserved verbatim from `world.ts:1300-1301`.
  return {
    kind: "key-based",
    value:
      ctx.fieldOverride !== undefined ? ctx.fieldOverride : applyModifiers(keyResult, innerSchema),
  };
}

// Step 6 — schema-based fallback.
export function schemaBasedStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
    const inner = ctx.state.inner;
    const innerUnwrapped = unwrap(inner);
    const innerDef = def(innerUnwrapped);
    const leafType = innerDef.type;
    if (leafType === "object" || leafType === "lazy") {
      if (ctx.explainMeta !== null) {
        ctx.explainMeta.identifier = "schema-based:object";
        ctx.explainMeta.reason = "nested object — call explain(<FieldSchema>) for details";
      }
      return { kind: "schema-based", value: undefined };
    }
    if (leafType === "array") {
      if (ctx.explainMeta !== null) {
        ctx.explainMeta.identifier = "schema-based:array";
        ctx.explainMeta.reason = "array — element type explained on demand";
      }
      return { kind: "schema-based", value: undefined };
    }
    if (ctx.explainMeta !== null) {
      ctx.explainMeta.identifier = "schema-based";
      ctx.explainMeta.reason = "no key match, no matcher";
    }
    return { kind: "schema-based", value: undefined };
  }
  const innerSchema = ctx.state.inner;
  const innerUnwrapped = unwrap(innerSchema);
  const innerDef = def(innerUnwrapped);
  const isObjectLike = innerDef.type === "object" || innerDef.type === "lazy";
  if (isObjectLike) {
    return {
      kind: "schema-based",
      value: ctx.fieldCtx.generate(innerSchema, { overrides: ctx.fieldOverride }),
    };
  }
  return {
    kind: "schema-based",
    value:
      ctx.fieldOverride !== undefined
        ? ctx.fieldOverride
        : generateFromSchema(innerSchema, ctx.fieldCtx),
  };
}

// ---------------------------------------------------------------------------
// PIPELINE — exact seven named step functions in pipeline order.
// PIPELINE_NO_REGISTRATION — three-step subset for `generateZodObject`
// (omits override, matcher, schemaKeyMap, customKeyGen — explicit absence).
// ---------------------------------------------------------------------------

export const PIPELINE: ReadonlyArray<PipelineStep> = [
  overrideEagerStep,
  matcherStep,
  schemaKeyMapStep,
  unwrapOptionalStep,
  customKeyGenStep,
  keyHeuristicStep,
  schemaBasedStep,
];

export const PIPELINE_NO_REGISTRATION: ReadonlyArray<PipelineStep> = [
  unwrapOptionalStep,
  keyHeuristicStep,
  schemaBasedStep,
];

// ---------------------------------------------------------------------------
// walkPipeline — sequential dispatcher
// ---------------------------------------------------------------------------

/**
 * Walks `pipeline` in order. Returns the first non-`null` `FieldResolution`
 * a step produces. `schemaBasedStep` always resolves, so the loop never
 * falls off the end for a valid context; the throw is a regression guard.
 */
export function walkPipeline(
  pipeline: ReadonlyArray<PipelineStep>,
  ctx: PipelineStepContext,
): FieldResolution {
  for (const step of pipeline) {
    const r = step(ctx);
    if (r !== null) return r;
  }
  throw new Error("pipeline did not resolve field — schema-based step regression");
}
