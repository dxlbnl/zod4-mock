# Markov Training Pipeline

The Markov models shipped in the library are pre-compiled artifacts — they cannot be hand-authored. This page documents the tooling required to build and maintain them.

## File Layout

```
scripts/
  train-markov.ts      # CLI: word list → TypeScript model constant
  verify-markov.ts     # CLI: print N samples from a model for inspection

data/training/
  en/
    first-names.txt    # One name per line, ~10k entries
    last-names.txt
    nouns-en.txt       # Common English nouns
    adjectives-en.txt
    verbs-en.txt
  nl/
    first-names.txt
    last-names.txt
    nouns-nl.txt
    adjectives-nl.txt
    verbs-nl.txt

src/generators/data/markov/
  en-first-names.ts    # export const enFirstNamesModel: MarkovModel = { ... }
  en-last-names.ts
  en-words.ts          # nouns, adjectives, verbs bundled (or split if size warrants)
  nl-first-names.ts
  nl-last-names.ts
  nl-words.ts
```

Generated model files are committed and should never be edited by hand. To update a model, edit the training corpus and re-run the training script.

## Training Corpus Sources

Sourcing good training data is the most important step. Poor data → poor output regardless of model quality.

### English (`en`)

| Data type | Source | Size | License |
|-----------|--------|------|---------|
| First names | US SSA baby names (ssa.gov/oact/babynames) | 100k+ names | Public domain |
| Last names | US Census Bureau surname list (census.gov) | 150k+ names | Public domain |
| Nouns / adjectives / verbs | WordNet lemma lists (wordnet.princeton.edu) | ~155k lemmas | Princeton WordNet license (permissive) |
| Common words | CMU Pronouncing Dictionary | ~134k entries | Public domain |

The SSA baby names file is released annually as a zip of per-year CSVs. A pre-processing script should deduplicate across years and normalize casing.

### Dutch (`nl`)

| Data type | Source | Size | License |
|-----------|--------|------|---------|
| First names | Meertens Instituut voornamenbank (meertens.knaw.nl) | ~10k+ | Open data |
| Last names | CBS top-10,000 Nederlandse achternamen (cbs.nl) | 10k | Open data |
| Words | OpenTaal woordenlijst (opentaal.org) | 350k | GPL / BSD |

OpenTaal's word list is large enough to need filtering before training — use a frequency-filtered subset (top 20k lemmas) to keep the model focused on common vocabulary.

## `train-markov.ts` Contract

```typescript
// Usage:
//   pnpm tsx scripts/train-markov.ts \
//     --input  data/training/en/first-names.txt \
//     --output src/generators/data/markov/en-first-names.ts \
//     --order  2 \
//     --prior  0.01 \
//     --name   enFirstNamesModel

interface CliOptions {
  input:  string;   // path to newline-delimited word list
  output: string;   // path to write the .ts file
  order:  number;   // Markov order (default: 2)
  prior:  number;   // Dirichlet smoothing value (default: 0.01)
  name:   string;   // exported constant name
}
```

The script:
1. Reads the input file, lowercases, deduplicates
2. Iterates all words, extracting n-gram → successor counts
3. Applies Dirichlet smoothing to each row
4. Converts raw counts to a compact CDF (see below)
5. Writes a `.ts` file containing a single `export const` with type `MarkovModel`

The output file is pure data — no imports, no logic.

## `MarkovModel` Type

```typescript
// src/types.ts (or src/generators/data/markov/types.ts)
export interface MarkovModel {
  order:  number;
  prior:  number;
  // Deduplicated character alphabet for this model
  chars:  string;          // e.g. "abcdefghijklmnopqrstuvwxyz$"
  // Transition table: bigram key → Float32Array of cumulative weights
  // Each Float32Array has the same length as chars
  table:  Record<string, Float32Array>;
}
```

Using `Float32Array` for the CDF keeps the model lean in memory and avoids V8 boxed-number overhead on the weight array.

## Compact CDF Encoding (in detail)

Given raw bigram counts:

```
"al" → { e: 14, i: 9, o: 3, x: 1 }   total = 27
```

After Dirichlet smoothing (prior = 0.01, alphabet size = 27):

```
P(e | "al") = (14 + 0.01) / (27 + 0.27) ≈ 0.507
P(i | "al") = (9  + 0.01) / (27 + 0.27) ≈ 0.326
P(o | "al") = (3  + 0.01) / (27 + 0.27) ≈ 0.109
P(x | "al") = (1  + 0.01) / (27 + 0.27) ≈ 0.036
```

Cumulative (CDF):

```
chars: "eiox"  →  cdf: [0.507, 0.833, 0.942, 1.000]
```

Stored as a `Float32Array([0.507, 0.833, 0.942, 1.000])`.

At generation time: `r = prng.random()`, binary-search the CDF for the first value ≥ `r`, return `chars[index]`. This is O(log k) where k is typically 3–8 for a well-trained name model.

## `verify-markov.ts` Contract

```typescript
// Usage:
//   pnpm tsx scripts/verify-markov.ts \
//     --model src/generators/data/markov/en-first-names.ts \
//     --count 50 \
//     --seed  12345

// Prints 50 generated samples to stdout for human inspection.
// Used to sanity-check models after (re-)training.
```

Add `pnpm train-markov` and `pnpm verify-markov` as convenience scripts in `package.json`.

## When to Retrain

- When adding a new locale
- When the training corpus source releases a new version (annually for SSA names)
- When output quality degrades (verify with `verify-markov.ts` samples)

Retrain, review the `verify-markov.ts` output, then commit the regenerated model file.

---

See also: [Algorithmic Entropy](algorithmic-entropy.md) · [Word Generation](word-generation.md) · [Back to Index](index.md)
