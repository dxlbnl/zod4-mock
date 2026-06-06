// B104-R6 — typed concept synonym manifest.
//
// The build step (scripts/pagefind-index.mjs) reads this manifest and emits a
// Pagefind synonym table so configured aliases (e.g. "field resolver") resolve
// to a single canonical concept (e.g. "matcher"). Keep the canonical `concept`
// aligned with the `<DefRef term="…">` terms used across the docs pages so the
// synonyms route to the concept's indexed pages.

export type ConceptSynonymEntry = {
  readonly concept: string;
  readonly synonyms: ReadonlyArray<string>;
};

export type ConceptSynonyms = ReadonlyArray<ConceptSynonymEntry>;

export const CONCEPT_SYNONYMS: ConceptSynonyms = [
  {
    concept: "matcher",
    synonyms: ["field resolver", "field matcher", "resolver", "ctx matcher"],
  },
  {
    concept: "world",
    synonyms: ["generation session", "seeded session", "context"],
  },
  {
    concept: "registry",
    synonyms: ["store", "data store", "instance store"],
  },
  {
    concept: "determinism",
    synonyms: ["deterministic", "reproducible", "stable output", "seeded output"],
  },
] as const;
