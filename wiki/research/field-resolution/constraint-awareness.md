# Constraint-Aware Generation

## What It Means

Most fakers are "blind" — you ask for a string, they give you one. If the schema requires `z.string().min(15).max(30)`, a naive faker generates strings until one fits, or truncates/pads afterward. Both approaches risk generating invalid data or wasting cycles.

`zod4-mock` walks the Zod AST, so it has complete context of all validation rules before generation starts. The goal is to pass these constraints directly into the generators so valid data is produced on the first try, mathematically.

## What's Already Done

**The schema-based path is already constraint-aware.** When the generation pipeline reaches the schema-based fallback (step 3), the Zod type introspection generators already read `min`/`max`/`multipleOf` from the AST:

- `src/generators/schema/string.ts` — reads `minLength`, `maxLength` checks before generating
- `src/generators/schema/number.ts` — resolves `min`, `max`, `multipleOf` bounds before picking a value
- `src/generators/schema/collection.ts` — reads array `minLength`/`maxLength` before deciding how many items to generate

No work needed in the schema-based path for basic constraints.

## The Remaining Gap: Key-Based Generators

**Key-based generators (step 2 in the pipeline) receive no constraint context.**

When a field named `"bio"` matches the key map and calls `person.bio(prng)`, that function has no awareness that the field has `.min(200).max(500)` on it. The bio generator produces whatever length it defaults to, which may fail validation.

The fix is to thread the raw Zod checks into `generateFromKey()`:

```typescript
// Current signature
function generateFromKey(key: string, prng: Prng, ctx: GeneratorContext): unknown;

// Proposed signature
function generateFromKey(
  key: string,
  prng: Prng,
  ctx: GeneratorContext,
  checks?: ZodCheck[], // raw checks from the field's Zod schema
): unknown;
```

Individual key-based generators then accept and apply the constraints:

```typescript
export function bio(prng: Prng, minLength = 50, maxLength = 160): string {
  // generate text that fits [minLength, maxLength]
}
```

The call site in the pipeline already has the Zod schema for the current field — extracting checks is straightforward via the existing `applyModifiers` / `zod-def.ts` helpers.

## Markov Chains and Constraints

Markov-based generators handle `min`/`max` natively during traversal — no post-generation trimming needed:

- **Enforcing `minLength`:** Filter the end-token `$` from possible next characters while `result.length < minLength`. The chain is forced to keep generating.
- **Enforcing `maxLength`:** Stop the loop when `result.length` reaches `maxLength`. Optionally bias toward end-token states in the last few characters to avoid hard mid-syllable cutoffs.

This is a key advantage of Markov generation over static lists: the generator can honor length constraints in a single pass. See [Algorithmic Entropy](../text-generation/algorithmic-entropy.md) for the full traversal implementation.

## Regex Constraints

`z.string().regex(/^[A-Z]{2}-\d{4}$/)` is currently handled by a fallback regex-matching strategy in `schema/string.ts`. This is slow (generate and test) for complex patterns.

A future improvement: a small regex-to-generator compiler that recognizes common patterns (character classes, quantifiers, alternation) and generates conforming strings directly. This is a larger standalone effort.

---

See also: [Algorithmic Entropy](../text-generation/algorithmic-entropy.md) · [Back to Index](../overview.md)
