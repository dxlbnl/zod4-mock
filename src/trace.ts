/**
 * @module trace
 *
 * Public, JSON-serializable provenance types for {@link World.trace}. The World
 * Explorer (and the future standalone HTML artifact) read this structure to make
 * a generated universe walkable: which records exist, where each field's value
 * came from, and which relation picks wired records together.
 *
 * These types are pure declarations — no class instances, functions, or symbols —
 * so a `WorldTrace` round-trips losslessly through `JSON.stringify` /
 * `JSON.parse`. They are a binding public contract: B86 (field capture), B87
 * (edge capture), and B88 (friendly type names) fill in the substance against
 * these exact shapes.
 */

import type { FieldExplanation } from "./types.js";

/**
 * Which pipeline rung resolved a {@link TraceField}'s value. A standalone,
 * public-stable union — intentionally decoupled from the internal
 * `FieldResolution["kind"]` so a future pipeline rename forces a deliberate
 * update to the capture-boundary mapping (B86) rather than silently breaking
 * this public contract.
 */
export type TraceResolution =
  | "override"
  | "matcher"
  | "keymap"
  | "absent"
  | "default"
  | "custom-gen"
  | "key-based"
  | "schema-based";

/**
 * Per-field provenance entry on a {@link TraceNode}. Extends `FieldExplanation`
 * so `world.trace()` and `world.explain()` speak one provenance language:
 * `generator` (a stable generator-id string, e.g. `'person.firstName'`,
 * `'matcher:<key>'`, `'schema-based'`) and `reason` (a short human-readable
 * explanation) carry the identical meaning in both. Adds the trace-only fields:
 * the field `path`, the produced `value`, the resolving `resolution` rung, the
 * PRNG `forkKey`, whether an override won (`overridden`), and the relation/field
 * `dependsOn` keys consulted.
 */
export interface TraceField extends FieldExplanation {
  /** Dotted field path within the record (e.g. `"user.email"`). */
  readonly path: string;
  /** The value produced for this field. JSON-serializable. */
  readonly value: unknown;
  /** Which pipeline rung resolved the value. */
  readonly resolution: TraceResolution;
  /** The PRNG fork key used to seed this field. */
  readonly forkKey: string;
  /** Whether an `options.overrides` entry won over the pipeline value. */
  readonly overridden: boolean;
  /** Sibling field / relation keys this field's value depended on. */
  readonly dependsOn: string[];
}

/**
 * One generated record in a {@link WorldTrace}.
 *
 * `id` is the stable, human-friendly `` `${typeName}#${index}` `` id (e.g.
 * `"person#1"`, `"order#5"`) — a binding public contract: the `typeName` is the
 * registration's display name (the Zod schema's `.description`, else the stable
 * `` `schema${id}` `` fallback), and the `<index>` is **1-based** (the first
 * record of a type is `#1`). When two registrations of the same polarity resolve
 * to the same display name, the id auto-disambiguates by registration order
 * (`user`, `user-2`, `user-3`, …) rather than throwing. `type` is that same
 * resolved `typeName`. `index` is the record's **0-based** position within its
 * registration. `value` is the stored record; `store` reflects whether the
 * record was written to the registry. `derivedFrom` is present only for derived
 * records and holds the source node's friendly id (e.g. `"person#1"`). `fields`
 * is the per-field provenance (empty at the B85 stub; B86 populates it).
 */
export interface TraceNode {
  /** Friendly `` `${typeName}#${index}` `` id (1-based index), e.g. `"person#1"`. */
  readonly id: string;
  readonly type: string;
  readonly index: number;
  readonly value: unknown;
  /** For derived records, the friendly id of the source node (e.g. `"person#1"`). */
  readonly derivedFrom?: string;
  readonly store: boolean;
  readonly fields: TraceField[];
}

/**
 * One relation pick in a {@link WorldTrace}: the `from` node's `fromField`
 * referenced the `to` node via the named `relation`, a one-to-one (`"one"`) or
 * one-to-many (`"many"`) pick drawn from a pool of `poolSize` candidates at
 * `pickedIndex`. (Empty at the B85 stub; B87 populates `edges`.)
 */
export interface TraceEdge {
  readonly from: string;
  readonly fromField: string;
  readonly to: string;
  readonly relation: string;
  readonly kind: "one" | "many";
  readonly poolSize: number;
  readonly pickedIndex: number;
}

/**
 * The full provenance structure returned by {@link World.trace}: the world's
 * root `seed`, one {@link TraceNode} per stored record, and one
 * {@link TraceEdge} per relation pick. Fully JSON-serializable.
 */
export interface WorldTrace {
  readonly seed: number;
  readonly nodes: TraceNode[];
  readonly edges: TraceEdge[];
}
