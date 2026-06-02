---
id: B65
title: BUG — `locale` doesn't thread into `ctx.gen.*` calls inside matchers
type: bug
priority: medium
flags: [review]
created: 2026-06-02
---

## Description

When a matcher calls `ctx.gen.word.sentence()` (or any other `ctx.gen.<domain>.<fn>()`
generator) and the outer call set `{ locale: en }`, the inner generator sees
`defaultLocale`, not the explicitly-passed locale. Result: `loc.formatSentence` and any
other locale callbacks never fire when reached via `ctx.gen.*` from a matcher.

## Reproduction

Surfaced in the playground demo for B58-A:

```ts
const SentencesSchema = z.object({
  a: z.string(),
  b: z.string(),
  c: z.string(),
  d: z.string(),
  e: z.string(),
});
const world = createWorld({ seed: 42 }).withSchema(SentencesSchema, {
  matchers: {
    a: (ctx) => ctx.gen.word.sentence(),
    // …
  },
});
world.generate(SentencesSchema, { locale: en });
// → Sentences use defaultLocale's `verbs` / `pronouns` / `nouns` / `adjectives`,
//   not locale-en's formatSentence (which would have applied 3ps inflection,
//   the Template 2 pronoun constraint, plural-noun rule, etc.).
```

Observable trace: the playground output `"They is a Great Piece."` and similar — `They`
is in `defaultLocale.word.pronouns` but **not** in locale-en's `PRONOUNS_3PS`. `is` is in
`defaultLocale.word.verbs` but **not** in locale-en's lemma list. So the sentence is
demonstrably going through the **library fallback path** (`src/generators/data/word.ts:142-174`)
against `defaultLocale`, not through `en.word.formatSentence`.

## Where the gap is

Per [`src/generators/data/word.ts:134`](../../../src/generators/data/word.ts):

```ts
const loc = (ctx?.locale ?? defaultLocale).word;
```

So `sentence()` does read `ctx.locale`. The question is: when a matcher fires
`ctx.gen.word.sentence()`, does the inner `ctx` it sees carry `locale: en`?

Investigation entry point: trace `ctx.gen` construction in the engine. Likely candidates:
the per-record matcher dispatch in `src/world/engine.ts` (or wherever `ctx.gen` is built)
binds generators against a `ctx` that was assembled before `options.locale` was merged in.
Or `ctx.gen.*` calls into a shared bound generator that was bound at world-construction
time with a default-locale closure.

## Preliminary acceptance

- **R1** — When `world.generate(S, { locale: en })` invokes a matcher whose body calls
  `ctx.gen.word.sentence()`, the inner `sentence()` MUST observe `ctx.locale === en`. The
  same holds for every `ctx.gen.<domain>.<fn>()` reachable from a matcher.
- **R2** — Regression test (D6): a matcher schema where `ctx.gen.word.sentence()` is called
  with `{ locale: en }` MUST produce a sentence containing a verb token absent from
  `defaultLocale.word.verbs` but present as a 3ps-conjugated form of an entry in
  `en.word.verbLemmas` (proof that locale-en's `formatSentence` fired).
- **R3** — No new public API on `World` / `GeneratorContext` / matcher contract; this is
  a wiring bug, not a contract change.
- **R4** — Changeset `patch` (behaviour fix, not API change). Snapshot re-pin if any
  integration test asserts a specific `ctx.gen.*`-derived value under a non-default
  locale.

## Notes

- **Predecessor**: B58-A (which introduced `loc.formatSentence` and revealed the bug).
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID. R1 / R2 covered
  by a single matcher-locale assertion test.
- **No GitHub issue** filed.
- `flags: [review]` — the fix touches engine-side ctx construction; review to confirm
  no determinism regression (per-field PRNG fork must still hold).
