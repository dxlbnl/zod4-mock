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

/** Ordered, name-keyed curation list. Render order = array order. */
export const CURATION: ReadonlyArray<CurationEntry> = [
  // Entry points
  { name: "generate", group: "Entry points" },
  { name: "createWorld", group: "Entry points" },

  // PRNG
  { name: "createPrng", group: "PRNG" },
  { name: "fieldSeed", group: "PRNG" },

  // Generators
  { name: "generators", group: "Generators" },
  { name: "data", group: "Generators" },
  { name: "generateFromSchema", group: "Generators" },
  { name: "generateFromKey", group: "Generators" },
  { name: "DEFAULT_KEY_MAP", group: "Generators" },
  { name: "DEFAULT_KEY_PATTERNS", group: "Generators" },

  // Localization
  { name: "extend", group: "Localization" },

  // Core types
  { name: "World", group: "Core types" },
  { name: "WorldOptions", group: "Core types" },
  { name: "Registry", group: "Core types" },

  // Generation types
  { name: "GeneratorContext", group: "Generation types" },
  { name: "MatcherCtx", group: "Generation types" },
  { name: "BoundGenerators", group: "Generation types" },
  { name: "Prng", group: "Generation types" },
  { name: "PrngGen", group: "Generation types" },
  { name: "KeyGenerator", group: "Generation types" },
  { name: "KeyPattern", group: "Generation types" },

  // Schema registration
  { name: "SchemaOpts", group: "Schema registration" },
  { name: "SchemaKeyMap", group: "Schema registration" },

  // Override / transform
  { name: "GenerateOptions", group: "Override / transform" },
  { name: "DeepPartial", group: "Override / transform" },

  // Explain
  { name: "ExplainResult", group: "Explain" },
  { name: "FieldExplanation", group: "Explain" },
  { name: "RelationExplanation", group: "Explain" },

  // World Explorer (trace)
  { name: "WorldTrace", group: "World Explorer" },
  { name: "TraceNode", group: "World Explorer" },
  { name: "TraceField", group: "World Explorer" },
  { name: "TraceEdge", group: "World Explorer" },
  { name: "TraceResolution", group: "World Explorer" },

  // Localization types
  { name: "LocaleData", group: "Localization types" },
  { name: "LastNamePrefix", group: "Localization types" },
  { name: "Currency", group: "Localization types" },
];

/** Public export names intentionally excluded from the rendered docs (none today). */
export const EXCLUDE: ReadonlyArray<string> = [];
