import type { ZodTypeAny } from "zod";
import type { GeneratorContext, KeyGenerator } from "./types.js";
import type { TraceResolution } from "./trace.js";
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

export type FieldResolution =
  | { kind: "override"; value: unknown }
  | { kind: "matcher"; value: unknown }
  | { kind: "keymap"; value: unknown }
  | { kind: "absent"; value: undefined | null }
  | { kind: "default"; value: unknown }
  | { kind: "custom-gen"; value: unknown }
  | { kind: "key-based"; value: unknown }
  | { kind: "schema-based"; value: unknown };

export interface PipelineState {
  inner: ZodTypeAny;
}

export interface PipelineStepContext {
  readonly fieldSchema: ZodTypeAny;
  readonly fieldName: string;
  readonly fieldCtx: GeneratorContext;
  readonly fieldOverride: unknown;
  readonly reg: SchemaReg;
  readonly outerSchema: ZodTypeAny;
  readonly resolvedSchema: ZodTypeAny;
  readonly customKeyGenerators: ReadonlyMap<string, KeyGenerator>;
  readonly schemaKeyMaps: ReadonlyMap<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  >;
  readonly optionalProbability: number;
  // When true, steps MUST NOT execute side-effects (no PRNG draws,
  // applyModifiers, or generator invocations) — they report the would-be
  // resolution with value: undefined.
  readonly dryRun: boolean;
  readonly state: PipelineState;
  // null on the hot generate() path so the per-field ctx avoids allocating a
  // nested object; only the explain() path constructs a {}. Writers null-check.
  readonly explainMeta: { identifier?: string; reason?: string } | null;
}

export type PipelineStep = (ctx: PipelineStepContext) => FieldResolution | null;

// `satisfies` keeps this exhaustive so an internal rung rename forces an update
// here rather than silently breaking the public world.trace() contract.
const KIND_TO_TRACE_RESOLUTION = {
  override: "override",
  matcher: "matcher",
  keymap: "keymap",
  absent: "absent",
  default: "default",
  "custom-gen": "custom-gen",
  "key-based": "key-based",
  "schema-based": "schema-based",
} satisfies Record<FieldResolution["kind"], TraceResolution>;

export function traceResolutionForKind(kind: FieldResolution["kind"]): TraceResolution {
  return KIND_TO_TRACE_RESOLUTION[kind];
}

function isPlainObjectOverride(o: object): boolean {
  const proto = Object.getPrototypeOf(o);
  return proto === Object.prototype || proto === null;
}

export function applyObjectOverride(value: unknown, fieldOverride: unknown): unknown {
  if (fieldOverride === undefined) return value;
  return deepMerge(value, fieldOverride);
}

export function applyOverride(
  fieldOverride: unknown,
  generateRaw: () => FieldResolution,
): FieldResolution {
  if (fieldOverride === undefined) return generateRaw();
  // Primitive / atomic-object override → replace verbatim without generating a
  // base: no PRNG draw, and it avoids generating an otherwise un-mockable schema
  // the override is replacing (e.g. z.instanceof(RegExp)).
  if (
    fieldOverride === null ||
    typeof fieldOverride !== "object" ||
    (!Array.isArray(fieldOverride) && !isPlainObjectOverride(fieldOverride))
  ) {
    return { kind: "override", value: fieldOverride };
  }
  const raw = generateRaw();
  // A plain-object/array override forces the field present, so raw.kind is never
  // "absent"; the guard narrows the union.
  if (raw.kind === "absent") return raw;
  if (Array.isArray(fieldOverride)) {
    const overrides = fieldOverride;
    const base = Array.isArray(raw.value) ? raw.value : [];
    // Override length sets the element count: a base longer than the override is
    // truncated, a shorter base leaves surplus override slots as their own value,
    // and a hole leaves the base element fully generated.
    const merged = Array.from({ length: overrides.length }, (_, i) => {
      const ov = overrides[i];
      const item = base[i];
      if (ov === undefined) return item;
      return item !== undefined ? deepMerge(item, ov) : ov;
    });
    return { kind: raw.kind, value: merged };
  }
  return { kind: raw.kind, value: deepMerge(raw.value, fieldOverride) };
}

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

export function overrideEagerStep(_ctx: PipelineStepContext): FieldResolution | null {
  return null;
}

export function matcherStep(ctx: PipelineStepContext): FieldResolution | null {
  const m = ctx.reg.matchers[ctx.fieldName];
  if (!m) return null;
  if (ctx.explainMeta !== null) {
    ctx.explainMeta.identifier = `matcher:${ctx.fieldName}`;
    ctx.explainMeta.reason = "matcher registered via withSchema";
  }
  if (ctx.dryRun) {
    return { kind: "matcher", value: undefined };
  }
  return { kind: "matcher", value: m(ctx.fieldCtx) };
}

export function schemaKeyMapStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
    // The schemaKeyMaps Map carries the single merged record built by
    // explainSchema's caller; checking by name keeps explain output identical.
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
  if (ctx.explainMeta !== null) {
    ctx.explainMeta.identifier = `key-map:${ctx.fieldName}`;
    ctx.explainMeta.reason = "per-schema key map registered via withKeyMap";
  }
  return { kind: "keymap", value: fn(ctx.fieldCtx) };
}

export function unwrapOptionalStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
    // Explain-mode: do not consume PRNG state — walk the wrapper chain
    // statically just to populate state.inner.
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

export function customKeyGenStep(ctx: PipelineStepContext): FieldResolution | null {
  const lk = ctx.fieldName.toLowerCase();
  const customGen = ctx.customKeyGenerators.get(lk);
  if (customGen === undefined) return null;
  if (ctx.explainMeta !== null) {
    ctx.explainMeta.identifier = `custom:${lk}`;
    ctx.explainMeta.reason = "custom generator registered via withGenerators";
  }
  if (ctx.dryRun) {
    return { kind: "custom-gen", value: undefined };
  }
  const innerSchema = ctx.state.inner;
  return {
    kind: "custom-gen",
    value: applyModifiers(customGen(innerSchema, ctx.fieldCtx), innerSchema),
  };
}

export function keyHeuristicStep(ctx: PipelineStepContext): FieldResolution | null {
  if (ctx.dryRun) {
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
  // Mirror the dry-run exact-key / pattern lookup so trace() and explain() agree.
  if (ctx.explainMeta !== null) {
    const leafType = def(unwrap(innerSchema)).type;
    const lk = ctx.fieldName.toLowerCase();
    const exact = identifierForExactKey(leafType, lk);
    if (exact !== undefined) {
      ctx.explainMeta.identifier = exact;
      ctx.explainMeta.reason = `exact key: "${lk}"`;
    } else {
      const hit = patternHit(leafType, lk);
      if (hit !== undefined) {
        ctx.explainMeta.identifier = hit.identifier;
        ctx.explainMeta.reason = `key-pattern: ${hit.label}`;
      }
    }
  }
  return {
    kind: "key-based",
    value: applyModifiers(keyResult, innerSchema),
  };
}

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
  if (ctx.explainMeta !== null) {
    const leafType = innerDef.type;
    if (leafType === "object" || leafType === "lazy") {
      ctx.explainMeta.identifier = "schema-based:object";
      ctx.explainMeta.reason = "nested object — call explain(<FieldSchema>) for details";
    } else if (leafType === "array") {
      ctx.explainMeta.identifier = "schema-based:array";
      ctx.explainMeta.reason = "array — element type explained on demand";
    } else {
      ctx.explainMeta.identifier = "schema-based";
      ctx.explainMeta.reason = "no key match, no matcher";
    }
  }
  const isObjectLike = innerDef.type === "object" || innerDef.type === "lazy";
  if (isObjectLike) {
    return {
      kind: "schema-based",
      value: ctx.fieldCtx.generate(innerSchema),
    };
  }
  return {
    kind: "schema-based",
    value: generateFromSchema(innerSchema, ctx.fieldCtx),
  };
}

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
