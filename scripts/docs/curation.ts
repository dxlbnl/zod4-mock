/**
 * B102-R3 — hand-maintained curation layer for the generated API manifest.
 *
 * This module carries ONLY ordering/grouping/include-exclude metadata, keyed by
 * the public export's **name**. It deliberately carries no `signature` and no
 * `description`: per-symbol prose comes from the TSDoc on the real `src/` export
 * and the signature is extracted from the real types (see `scripts/docs/extract.ts`).
 *
 * The render order of `/docs/api` and `docs/api-reference.md` is the order of
 * this list. Any public export of `src/index.ts` not listed here (and not in
 * `EXCLUDE`) is appended deterministically (sorted by name) after the curated
 * symbols and surfaced by the extractor's coverage check, so an un-curated
 * public symbol can never silently vanish from the docs.
 */

/** A single curation entry: a public export name and its render group. */
export interface CurationEntry {
  readonly name: string;
  readonly group: string;
}

/**
 * Ordered, name-keyed curation list. Render order = array order.
 *
 * B115: consolidated to a small set of clearly-labelled, evaluator-orientable
 * groups (a clean mental model) — the zero-config + world entry points, the
 * session/store types, the matcher/generator authoring surface, the built-in
 * generators + key heuristics, per-call tuning + introspection, the PRNG
 * surface, the World Explorer trace contract, and localization.
 */
export const CURATION: ReadonlyArray<CurationEntry> = [
  // Getting started — the zero-config + world entry points.
  { name: "generate", group: "Getting started" },
  { name: "createWorld", group: "Getting started" },

  // World & registry — the session + store types a consumer reads.
  { name: "World", group: "World & registry" },
  { name: "WorldOptions", group: "World & registry" },
  { name: "Registry", group: "World & registry" },

  // Matchers & generation context — what a matcher/generator author touches.
  { name: "GeneratorContext", group: "Matchers & generation context" },
  { name: "MatcherCtx", group: "Matchers & generation context" },
  { name: "BoundGenerators", group: "Matchers & generation context" },
  { name: "SchemaOpts", group: "Matchers & generation context" },
  { name: "SchemaKeyMap", group: "Matchers & generation context" },
  { name: "KeyGenerator", group: "Matchers & generation context" },
  { name: "KeyPattern", group: "Matchers & generation context" },

  // Generators & key heuristics — the built-in generator surface.
  { name: "generators", group: "Generators & key heuristics" },
  { name: "data", group: "Generators & key heuristics" },
  { name: "generateFromSchema", group: "Generators & key heuristics" },
  { name: "generateFromKey", group: "Generators & key heuristics" },
  { name: "DEFAULT_KEY_MAP", group: "Generators & key heuristics" },
  { name: "DEFAULT_KEY_PATTERNS", group: "Generators & key heuristics" },

  // Options, overrides & explain — per-call tuning + introspection.
  { name: "GenerateOptions", group: "Options, overrides & explain" },
  { name: "DeepPartial", group: "Options, overrides & explain" },
  { name: "ExplainResult", group: "Options, overrides & explain" },
  { name: "FieldExplanation", group: "Options, overrides & explain" },
  { name: "RelationExplanation", group: "Options, overrides & explain" },

  // Randomness — the PRNG surface.
  { name: "createPrng", group: "Randomness" },
  { name: "fieldSeed", group: "Randomness" },
  { name: "Prng", group: "Randomness" },
  { name: "PrngGen", group: "Randomness" },

  // World Explorer (trace) — the provenance contract.
  { name: "WorldTrace", group: "World Explorer (trace)" },
  { name: "TraceNode", group: "World Explorer (trace)" },
  { name: "TraceField", group: "World Explorer (trace)" },
  { name: "TraceEdge", group: "World Explorer (trace)" },
  { name: "TraceResolution", group: "World Explorer (trace)" },

  // Localization — locales + locale data.
  { name: "extend", group: "Localization" },
  { name: "LocaleData", group: "Localization" },
  { name: "LastNamePrefix", group: "Localization" },
  { name: "Currency", group: "Localization" },
];

/** Public export names intentionally excluded from the rendered docs (none today). */
export const EXCLUDE: ReadonlyArray<string> = [];
