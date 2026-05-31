# Key Matching

## The Problem

The key-based generator pipeline (step 2 in generation) matches a field name against `DEFAULT_KEY_MAP` — a 165-entry object — using a normalized, case-insensitive string lookup:

```typescript
// Simplified from key-map.ts
const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
const generator = DEFAULT_KEY_MAP[normalized];
```

Object property lookup on a plain JavaScript object is O(1) for exact matches, which is already fast. However, the key map also has **pattern-based fallback** via `DEFAULT_KEY_PATTERNS` — a list of regex patterns tested sequentially until one matches:

```typescript
for (const [pattern, generator] of DEFAULT_KEY_PATTERNS) {
  if (pattern.test(key)) return generator;
}
```

With 10–15 regex patterns, this is O(P × key_length) per unmatched field. As the key map grows with Dutch aliases, English variants, and eventually multi-locale synonyms, both the exact map and the pattern list grow.

## The Proposal: Compiled Trie for Exact Matching

Replace the plain object for exact key matching with a **trie** (prefix tree) compiled at build time. A trie gives O(k) lookup where k = key length, with no hash collision risk and excellent cache locality for the common short-key case.

For the pattern-based fallback, compile the patterns into a **single merged regex** with named capture groups rather than a sequential loop:

```typescript
// Instead of looping 15 regex tests:
const merged = /(?<uuid>.*(?:id|uuid|guid).*)|(?<url>.*(?:url|link).*)|.../i;
const match = merged.exec(normalizedKey);
if (match?.groups) {
  const kind = Object.keys(match.groups).find((k) => match.groups![k] !== undefined);
  return kind ? PATTERN_GENERATORS[kind] : undefined;
}
```

A single regex engine pass is faster than 15 sequential `.test()` calls.

## Build-Time Compilation

The trie and merged regex are generated from the same source data as `DEFAULT_KEY_MAP` and `DEFAULT_KEY_PATTERNS`. A small build script outputs a compiled lookup structure:

```
scripts/
  compile-key-map.ts   # reads key-map source data → outputs compiled trie + merged regex

src/generators/data/
  key-map.ts           # human-authored source: the maps and patterns
  key-map-compiled.ts  # auto-generated: trie + merged regex (committed, not edited by hand)
```

The compiled file is committed like the Markov model files — re-run the script when the source key map changes.

## Size Reality Check

At 165 entries with short keys, the current object scan is already very fast in V8 — hash map lookups are highly optimized. This improvement matters most when:

1. The key map grows to 300+ entries (multi-locale synonyms)
2. The pattern list grows beyond ~20 patterns
3. `generateFromKey` is called in a hot loop (batch generation of many records)

It's a lower priority than the PRNG, Markov, and localization work — but worth compiling in as a build step once the key map sources stabilize.

## Pattern Priority

Regardless of implementation, the lookup priority chain must stay:

1. Exact key match (key-map compiled trie)
2. Pattern match (merged regex or sequential, TBD on size)
3. Schema-based generation fallback

This order is a correctness guarantee — patterns must never override an exact match.

---

See also: [Constraint-Aware Generation](../field-resolution/constraint-awareness.md) · [Batch Generation](batch-generation.md) · [Back to Index](../overview.md)
