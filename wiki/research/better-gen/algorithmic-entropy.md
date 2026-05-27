# Algorithmic Entropy: Markov Chains

Traditional fakers ship massive JSON dictionaries (10,000 last names, 5,000 words). These bloat the bundle and still eventually repeat. Instead, we ship a tiny **pre-compiled transition matrix** trained on those datasets and traverse it at runtime with the PRNG.

A character-level Markov chain captures the probability that a given character follows a sequence of n previous characters (n-grams). Traversing this with the PRNG produces infinite, plausible-sounding output that is still fully deterministic and seedable.

## What Gets Markov Treatment

Markov generation applies to **open-class words** — words that can be invented without breaking anything:

| Generator | Apply Markov? | Reason |
|-----------|:---:|--------|
| `firstName`, `lastName` | ✅ | Invented names that sound real are fine |
| `noun`, `adjective`, `verb`, `adverb` | ✅ | Generated pseudo-words in sentences |
| `company.buzzNoun`, `buzzAdjective` | ✅ | Corporate jargon is forgiving |
| Country codes, currency codes | ❌ | Must be exact real values |
| IBAN prefixes, phone prefixes | ❌ | Must be exact real values |
| Articles, prepositions, conjunctions | ❌ | Closed-class; grammatical roles require real words |

For all the ❌ cases, keep curated real-data lists. See also: [Word Generation](word-generation.md) for the full open/closed-class breakdown.

## How it Works

An Order-2 model tracks what character tends to follow every pair of characters seen in the training corpus. The model is a lookup table from bigram → list of successor characters (with frequency encoded as weights):

```typescript
// Simplified view of what the model contains
// (real model uses compact CDF encoding — see Markov Training Pipeline)
const enNamesModel = {
  "^^": ["A", "B", "C", "D", "E", "J", "K", "L", "M", "R", "S"],
  "^A": ["l", "n", "r"],
  "Al": ["e", "i", "b"],
  "le": ["x", "s", "y", "$"],
  "ex": ["a", "i"],
  // ...hundreds more entries
  "$$": [],  // terminal
};
```

The generator walks this table until it emits the end-of-word token `$`:

```typescript
function generateMarkovWord(
  prng: Prng,
  model: MarkovModel,
  minLength = 2,
  maxLength = 12,
): string {
  const { order, chars, table } = model;
  let state = "^".repeat(order);
  let result = "";

  while (result.length < maxLength) {
    const row = table[state];
    if (!row) break;

    // Sample from the CDF weights (see Training Pipeline for encoding)
    const nextChar = sampleCdf(prng, chars, row, result.length < minLength);
    if (nextChar === "$") break;

    result += nextChar;
    state = state.slice(1) + nextChar;
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}
```

**Example output** (Order-2, trained on 40 classic English names):
- Oliet, Wilher, Lean, Hanor, Alia, Chary, Nargabel

Trained on 10,000+ real names, the output is indistinguishable from real names to most readers.

## Constraint Awareness

The traversal loop can be steered to respect Zod `min`/`max` constraints without retrying:

**Enforcing `minLength`:** While `result.length < minLength`, filter the end-token `$` out of the CDF sample. The chain is forced to keep going.

**Enforcing `maxLength`:** As `result.length` approaches `maxLength`, bias toward states that have a path to `$` within the remaining budget. For the hard cutoff, simply stop and capitalize — this is safe because the CDF encoding gives good mid-word termination points.

See [Constraint-Aware Generation](constraint-awareness.md) for the broader picture.

## Dirichlet Smoothing

Without smoothing, a bigram state that never appeared in the training data causes a hard dead-end — the generator breaks. Dirichlet smoothing adds a small background probability `prior = 0.01` that *any* character can follow any state:

```
P(c | state) = (count(state → c) + prior) / (total(state) + prior × |alphabet|)
```

This prevents dead-ends entirely and also improves output diversity — less repetition of high-frequency paths.

## Order Selection

| Use case | Recommended order | Notes |
|----------|:---:|-------|
| First / last names | 2 | Sweet spot: realistic feel without being template-y |
| Content words (nouns, adjectives) | 3 | Richer phoneme clusters, more natural-sounding |
| Company buzzwords | 2 | Sufficient variety at smaller matrix size |

Higher order → matrix grows, but output quality plateaus around Order 3 for most word types.

## Compact CDF Encoding

The naive model stores arrays with repeated characters to represent frequency:

```typescript
// Naive: "a" appears 3× = 50% chance, "b" 2× = 33%, "c" 1× = 17%
"al": ["a", "a", "a", "b", "b", "c"]
```

This wastes space. Instead, store a parallel CDF (cumulative distribution function) as weights:

```typescript
// Compact: chars deduplicated, weights are cumulative probabilities
"al": { chars: ["a", "b", "c"], cdf: [0.50, 0.83, 1.00] }
```

Sampling: draw `r = prng.random()`, binary-search `cdf` for the first entry ≥ `r`. O(log k) per sample where k = number of distinct successors (typically 3–8). Cuts matrix memory by 3–5× for typical name corpora.

The actual stored format uses `Float32Array` for the CDF and a single `string` for the concatenated char alphabet — see [Markov Training Pipeline](markov-training-pipeline.md) for the exact format.

---

See also: [Markov Training Pipeline](markov-training-pipeline.md) · [Word Generation](word-generation.md) · [Constraint-Aware Generation](constraint-awareness.md) · [Back to Index](index.md)
