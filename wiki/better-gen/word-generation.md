# Word Generation

## The Current Approach

`word.ts` currently generates pseudo-words using a **3-state phoneme combinatorics** approach — it picks randomly from arrays of consonant clusters (onsets), vowels (nuclei), and ending clusters (codas):

```typescript
function generatePseudoWord(prng: Prng): string {
  const onset  = prng.pick(ONSETS);   // e.g. "str", "bl", "k"
  const nucleus = prng.pick(NUCLEI);  // e.g. "aa", "ei", "oe"
  const coda   = prng.pick(CODAS);    // e.g. "nd", "t", "rk"
  return onset + nucleus + coda;
}
```

This is essentially a hand-authored 3-state Markov chain. The phoneme arrays are Dutch phonology — they produce Dutch-sounding syllables. This is both a locale leak and a quality ceiling: the output is syllabically valid but not linguistically rich.

## The Proposal: Markov-Based Word Generation

Replace `generatePseudoWord()` with a proper character-level Markov chain trained on real word corpora. The model captures multi-syllable phoneme transitions and produces words that match the statistical feel of the target language far better than 3-state combinatorics.

The generator function stays simple:

```typescript
// Before
export function noun(prng: Prng): string {
  return generatePseudoWord(prng);
}

// After
export function noun(prng: Prng, ctx: GeneratorContext): string {
  return generateMarkovWord(prng, ctx.locale.word.nounModel);
}
```

The `nounModel`, `adjectiveModel`, and `verbModel` are carried in the locale object — Dutch and English produce words that sound like their respective languages without any shared logic. See [Localization Architecture](localization.md) and [Markov Training Pipeline](markov-training-pipeline.md).

## Open-Class vs. Closed-Class Words

This is the most important distinction in the word generator refactor:

| Class | Examples | Generator |
|-------|----------|-----------|
| **Open-class** (content words) | nouns, adjectives, verbs, adverbs | Markov — infinite invented variety |
| **Closed-class** (function words) | articles, prepositions, conjunctions, pronouns, interjections | Real word lists in the locale — grammar requires specific real words |

**Why closed-class must stay real:** Articles like "the" and "a" (English) or "de" and "het" (Dutch) have specific grammatical roles. An invented article ("blor") breaks the sentence structurally. These lists are tiny (10–30 words per locale) so there is no bundle cost to keeping them real.

The current `word.ts` exports both types from the same file. After the refactor:
- `noun()`, `adjective()`, `verb()`, `adverb()` → Markov models in locale
- `conjunction()`, `preposition()`, `article()`, `pronoun()` → locale data arrays

## Phrase Structure Grammar for `sentence()` and `paragraph()`

The current `sentence()` function concatenates words in a roughly random order. A tiny **context-free grammar** produces output that is syntactically plausible (if semantically nonsensical), which is what most UI mock data needs:

```
S  → NP VP
NP → Det Adj? N
VP → V NP?
```

Implemented as a small rule table with PRNG-driven optional expansions:

```typescript
function sentence(prng: Prng, ctx: GeneratorContext): string {
  const loc = ctx.locale.word;
  const det  = prng.pick(loc.articles);
  const n    = noun(prng, ctx);
  const v    = verb(prng, ctx);

  // NP VP, optionally with adjective and object NP
  const adj  = prng.random() > 0.5 ? ` ${adjective(prng, ctx)}` : "";
  const hasObj = prng.random() > 0.5;
  const obj  = hasObj
    ? ` ${prng.pick(loc.articles)} ${noun(prng, ctx)}`
    : "";

  return capitalize(`${det}${adj} ${n} ${v}${obj}.`);
}
```

This is a significant improvement over random word concatenation with a tiny rule table (~5 lines). Sentences feel like sentences rather than word salad. `paragraph()` chains several of these with varied structures.

## Adverbs and Modifiers

Adverbs in the current generator are Dutch-only. After the refactor:
- English adverbs = Markov-generated from English word corpus + suffix rule: append `"ly"` to common adjective lemmas (e.g., `"quick"` → `"quickly"`)
- Dutch adverbs = similar morphological rule or a small curated list

This ties into [Conjugation-Based Compression](conjugation-compression.md) — deriving inflected forms from lemmas instead of storing them separately.

---

See also: [Algorithmic Entropy](algorithmic-entropy.md) · [Markov Training Pipeline](markov-training-pipeline.md) · [Conjugation-Based Compression](conjugation-compression.md) · [Localization Architecture](localization.md) · [Back to Index](index.md)
