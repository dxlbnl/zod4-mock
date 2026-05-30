# Conjugation-Based Word Compression

## The Problem

Word generators currently store each form of a word separately. For verbs in `company.ts` and `word.ts`, you might see:

```typescript
const BUZZ_VERBS = [
  "Stroomlijnen", "Stroomlijnt", "Gestroomlijnd",   // "streamline"
  "Optimaliseren", "Optimaliseert", "Geoptimaliseerd", // "optimize"
  // ...
];
```

Every inflected form costs bundle bytes. And the more forms you want (present, past, present-participle, past-participle), the worse it gets.

## The Solution: Lemma + Morphological Rules

Store only the **base form (lemma)** and derive inflections algorithmically at runtime. This is the technique used by [compromise.js](https://github.com/spencermountain/compromise) to pack 14,000 base word forms into ~250 KB — far less than the full inflected vocabulary would require.

For mock data generation we only need a handful of forms. The rules for common cases are simple:

### English Verb Rules

```typescript
const VERBS = ["streamline", "optimize", "scale", "leverage", "deploy"];

function verbPresent3ps(lemma: string): string {
  if (lemma.endsWith("e")) return lemma + "s";   // optimize → optimizes
  if (lemma.endsWith("y")) return lemma.slice(0, -1) + "ies"; // carry → carries
  return lemma + "s";                            // scale → scales
}

function verbGerund(lemma: string): string {
  if (lemma.endsWith("e")) return lemma.slice(0, -1) + "ing"; // optimize → optimizing
  return lemma + "ing";                          // scale → scaling
}

function verbPast(lemma: string): string {
  if (lemma.endsWith("e")) return lemma + "d";   // optimize → optimized
  return lemma + "ed";                           // scale → scaled
}
```

### Dutch Verb Rules

Dutch is more complex but the common mock-data forms are manageable:

```typescript
const NL_VERBS = ["stroomlijnen", "optimaliseren", "schalen", "inzetten"];

function dutchVerbPresent3ps(lemma: string): string {
  // Remove -en infinitive suffix, add -t
  const stem = lemma.endsWith("en") ? lemma.slice(0, -2) : lemma;
  return stem + "t";   // stroomlijnen → stroomlijnt
}

function dutchGerund(lemma: string): string {
  const stem = lemma.endsWith("en") ? lemma.slice(0, -2) : lemma;
  return stem + "end"; // stroomlijnen → stroomlijnend
}
```

### English Adjective → Adverb

One of the most useful rules for mock data — English adverbs are trivially derived:

```typescript
function toAdverb(adjective: string): string {
  if (adjective.endsWith("le")) return adjective.slice(0, -1) + "y";  // simple → simply
  if (adjective.endsWith("y"))  return adjective.slice(0, -1) + "ily"; // easy → easily
  return adjective + "ly";    // quick → quickly, smart → smartly
}
```

This means the `adverb()` generator needs no word list at all — just the adjective list plus this rule.

## Application to Current Generators

| Generator | Current approach | After refactor |
|-----------|-----------------|---------------|
| `buzzVerb()` | Array of verb forms | Lemma list + `verbPresent3ps()` |
| `adverb()` | Separate word list | Adjective list + `toAdverb()` rule |
| `buzzPhrase()` | Picks from inflected arrays | Picks lemma, applies form per grammar slot |
| `productDescription()` | Hardcoded phrases | Grammar template + inflected forms |

## Savings Estimate

For a typical 20-verb list with 3 inflected forms each (60 stored strings → 20 lemmas + 3 tiny functions):
- Storage: ~60 strings × avg 12 chars = ~720 bytes → ~240 bytes + negligible rule code
- **~3× reduction** in stored word data per category

At Markov-model scale (thousands of lemmas), the savings are proportional and the bundle impact is significant.

## Limitations

These simple suffix rules handle ~80% of common vocabulary. Irregular forms (English: `go → went`, Dutch: `zijn → is`) need explicit exceptions. Keep a small exception map for the most common irregulars:

```typescript
const IRREGULAR_PAST: Record<string, string> = {
  go: "went", make: "made", get: "got",
};

function verbPast(lemma: string): string {
  return IRREGULAR_PAST[lemma] ?? (lemma.endsWith("e") ? lemma + "d" : lemma + "ed");
}
```

For mock data purposes, a few dozen exception entries are sufficient.

---

See also: [Word Generation](word-generation.md) · [Localization Architecture](localization.md) · [Back to Index](../overview.md)
