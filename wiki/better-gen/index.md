# Better Data Generation: The Plan

This section documents the architectural plan to improve `zod4-mock` generators — making them faster, more realistic, smaller, and fully localizable. The goal is to beat `faker-js` across all three dimensions: **runtime speed**, **bundle size**, and **data quality**.

## Core Pillars

### Data & Realism
1. **[Localization Architecture](localization.md)**
   Moving from hardcoded Dutch/English strings to pluggable, tree-shakeable locale modules. Grammar, formatting, and cultural conventions are delegated to the locale. English becomes the new default.

2. **[Algorithmic Entropy: Markov Chains](algorithmic-entropy.md)**
   Replacing static name/word dictionaries with tiny pre-compiled transition matrices. The PRNG traverses the matrix at runtime, generating infinite plausible names and words without bundle bloat.

3. **[Word Generation](word-generation.md)**
   Replacing the current phoneme-combinatorics approach in `word.ts` with a proper Markov chain. Covers the distinction between open-class words (Markov-generated) and closed-class words (real lists). Includes a phrase structure grammar for `sentence()` and `paragraph()`.

4. **[Markov Training Pipeline](markov-training-pipeline.md)**
   The tooling required to actually build and maintain Markov models: training scripts, corpus sources per locale, the compact CDF encoding format, and Dirichlet smoothing.

5. **[Conjugation-Based Word Compression](conjugation-compression.md)**
   Instead of storing every inflected word form, store only the lemma and derive inflections algorithmically. Reduces word corpus size by 30–50% while increasing variety.

### Speed & Efficiency
6. **[PRNG Improvements](prng-batching.md)**
   Three improvements to the PRNG layer: (1) replace Mulberry32 with SFC32 for better statistical quality, (2) add `uint32()` and `bytes(n)` for batch bit extraction, (3) cache `fork()` results within a generation pass.

7. **[Batch Generation API](batch-generation.md)**
   A `generateBatch(schema, n)` API that amortizes field-path hashing across records, making bulk generation significantly faster.

8. **[Key Matching](key-matching.md)**
   Replace the linear 165-entry key map scan with a compiled trie for O(k) lookup.

### Correctness
9. **[Constraint-Aware Generation](constraint-awareness.md)**
   Leveraging Zod's AST to generate valid data on the first attempt. Covers the already-implemented schema path and the remaining gap in key-based generators.

10. **[Optimized Data Packing](data-packing.md)**
    Using delimited strings to improve V8 parse times — scoped to large static lists that will never be tree-shaken.

### API Surface & Composition
11. **[Sibling-Aware Generation](sibling-awareness.md)**
    Fields can read already-generated sibling values from the same object via `ctx.current`. Covers the ordering constraint, the gender → Markov model question (two separate chains), a `siblingString()` lookup helper, and a full catalogue of worthwhile sibling relationships — including manufacturer → model coherence and creditCardIssuer → card number prefix.

12. **[Generator Reuse & Composition](generator-reuse.md)**
    Where generators should compose each other instead of duplicating data. Covers: `domainWord` using `TECH_WORDS`/company prefixes, `bio` composing from job generators, `userAgent` delegating to a new `system.ts` module, `url` using a proper path list, and `jwt` using base64url.

12. **[Methods Inventory](methods-inventory.md)**
    Full catalogue of every generator method — existing, broken, and missing — with the generation strategy for each. Includes two proposed new modules (`system`, `color`) and an optional `git` module.

## Benchmark First

Before implementing any of the above, establish baselines by running a benchmark script comparing `zod4-mock` vs `faker-js` on:
- Bundle size (rollup bundle analysis, KB minified + gzipped)
- Cold-start parse time (V8 parse/compile, ms)
- Generation speed (ops/sec for a representative 20-field schema)

Each optimization should be validated against this baseline.
