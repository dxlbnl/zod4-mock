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

## Tuning Guide: Diagnosing Bad Output

Run `pnpm verify` and look for these failure modes. Each has a specific cause and fix.

---

### Failure: words are too long ("Risharoumas", "Rencorviccol")

**Cause A — corpus pollution.** The training corpus contains very long entries (compound words, multi-part names) that teach the model long n-gram chains are valid. Check:
```bash
awk '{ print length, $0 }' data/training/first-names-male.txt | sort -rn | head -20
```
If you see entries > 10 chars ("Soerinderpersad", "Shailinderkumar"), those are poisoning the bigram table.

**Fix: filter the corpus by length before training.** Add a `maxWordLen` option to the train call:
```typescript
await trainMarkov({ ..., maxWordLen: 10 });  // drop any entry > 10 chars
```
Inside `train-markov.ts`, apply this after deduplication:
```typescript
.filter(w => w.length <= (opts.maxWordLen ?? Infinity))
```

**Cause B — no length steering in the sampler.** `sampleMarkov` follows the raw CDF until `maxLen`. For diverse corpora many states have low `$` probability — the sampler just runs to the wall.

**Fix: add a length-bias check in `sampleMarkov`.** After the word exceeds a soft threshold, apply a progressive early-stop probability before the CDF draw:
```typescript
// After the word reaches softMax, probability of stopping grows linearly to 1 at maxLen
const softMax = Math.floor(maxLen * 0.6);   // e.g. 6 if maxLen=10
if (word.length >= minLen && word.length >= softMax) {
  const stopProb = (word.length - softMax) / (maxLen - softMax);
  if (prng.random() < stopProb) break;
}
```
At `softMax` the stop probability is 0%; at `maxLen-1` it reaches ~90%. This produces a natural length distribution rather than a hard wall.

---

### Failure: compound names ("Lisameria", "Carrinichka")

**Cause: the model merges two distinct names.** With order-2, "sa" → "m" is a valid transition from many names (Lisa**s**a → Maria). The model chains them. This is an order-2 fundamental limitation.

**Fix: train with order 3.** Trigrams are far more path-specific. The sequence `isa` → `r` would require an actual trigram `isar` present in training, which almost never appears at a name boundary.

```typescript
await trainMarkov({ ..., order: 3 });
```

Order-3 increases state count from ~600 to ~3,000–6,000 for a typical name corpus, but on 25k+ training entries that's well-supported. Bundle size impact is modest.

**Fix also: corpus size reduction.** 25,143 unique names is too many. This includes historical Dutch names, very rare names, and names from many linguistic origins — all contributing bigrams that cross-connect in unexpected ways. A curated list of the top 1,000–3,000 most common Dutch first names produces much cleaner output. If the source data has frequency counts, filter by frequency rather than arbitrary truncation.

---

### Failure: all nouns start with the same prefix ("Aang", "Aanvoerekvoe", "Aanslaankt")

**Cause: corpus dominated by compound words.** Dutch compound nouns starting with `aan-`, `be-`, `ge-`, `ver-` etc. each appear once, but collectively they overwhelm the starting bigrams. If 30% of training nouns start with `aan`, the model starts 30% of generated nouns with `aan`.

**Fix: strip compound words from the noun corpus.** Remove any word starting with a known Dutch compound prefix before training:
```typescript
const COMPOUND_PREFIXES = ["aan", "be", "ge", "her", "ont", "over", "ver", "uit", "in"];
const filtered = words.filter(w => !COMPOUND_PREFIXES.some(p => w.startsWith(p)));
```

Or, more robustly: filter to words appearing with high frequency in common Dutch text, discarding rare compound forms entirely.

---

### Failure: short names keep appearing ("Win", "Ger", "Ber")

**Cause: the corpus contains very short entries.** The training data may include nicknames, initials, or abbreviated forms (e.g. "a", "aa", "aad").

**Fix: filter by minimum length** in the train script:
```typescript
.filter(w => w.length >= (opts.minWordLen ?? 1))
```
For first names set `minWordLen: 3`. For nouns, `minWordLen: 4`.

The sampler's `minLen` parameter handles *generation* — but if the model was trained on short entries, it still learns high `$` probability at length 2–3, producing many short outputs even when `minLen` is set higher (since it resets and tries again, sometimes re-entering the same short path).

---

## Recommended Parameters per Model Type

| Model type | `order` | `maxWordLen` (corpus filter) | `minWordLen` (corpus filter) | `maxLen` (sampler) | `softMax` (sampler) |
|------------|:-------:|:----------------------------:|:----------------------------:|:-------------------:|:--------------------:|
| First names | 3 | 10 | 3 | 10 | 6 |
| Last names | 2 | 12 | 3 | 12 | 7 |
| Nouns | 2 | 8 | 4 | 8 | 5 |
| Adjectives | 2 | 10 | 4 | 10 | 6 |
| Verbs | 2 | 10 | 3 | 10 | 6 |

The sampler parameters (`maxLen`, `softMax`) should be passed per call-site, not stored in the model — they are generation preferences, not corpus properties.

---

## When to Retrain

- When adding a new locale
- When the training corpus source releases a new version (annually for SSA names)
- When output quality degrades (verify with `pnpm verify`)

Retrain, review the output, then commit the regenerated model file.

---

See also: [Algorithmic Entropy](algorithmic-entropy.md) · [Word Generation](word-generation.md) · [Back to Index](../overview.md)
