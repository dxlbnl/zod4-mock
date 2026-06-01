---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
"@zod4-mock/locale-en": minor
---

Add English inflection-at-generation-time as a third variety lever (joining Zipf-distributed picks and Benford-distributed numerics).

Under the locale-internal-inflection architecture, inflection rules live per-locale rather than in locale-core. `@zod4-mock/locale-core` gains a single cross-cutting callback type — `LocaleData.word.formatSentence?: (prng, ctx?) => string` — mirroring the existing `person.formatBio` / `commerce.formatProductName` / `company.formatBuzzPhrase` shapes. `@zod4-mock/locale-en` owns its grammar privately and ships its own `inflect` namespace publicly for matcher authors.

**`@zod4-mock/locale-core`** (types only):

- New `LocaleData.word.formatSentence?(prng, ctx?): string` callback.
- New `LocaleSentenceContext` interface (the minimal `{ locale? }` shape passed to the callback).
- `LocaleData.word.verbsPlural` marked `@deprecated` — migrate locale-side sentence composition to `formatSentence`. The field remains for back-compat; removal is a future major.

**`@zod4-mock/locale-en`** (implementation):

- New public `inflect` namespace export: `inflect.pluralize(noun)`, `inflect.conjugate(verb, "3ps" | "past" | "gerund" | "participle")`, `inflect.adverbFromAdjective(adj)`. Pure-JS, deterministic, zero-PRNG transforms with no host-locale dependence (no `Intl.*`). Matcher authors can import them via `import { inflect } from "@zod4-mock/locale-en"`.
- `word.formatSentence` ships the 5 English sentence templates — verb slots emit `inflect.conjugate(lemma, "3ps")` on a private 60-lemma list, the last noun slot of each template is pluralised via `inflect.pluralize`, and Template 2's pronoun slot is constrained to the closed 3ps-singular list `{he, she, it}` so the conjugated verb agrees with its subject (always-fixed per call site per the report's Q-2 lock — no extra PRNG draw).
- `word.adverbs` is derived at module init from the 8-entry reserved closed list plus `adjectives.map(inflect.adverbFromAdjective)` (~3000 entries; the prior shape shipped only the 8 reserved entries).
- `company.formatBuzzPhrase` wraps its `verb` argument in `inflect.conjugate(verb, "3ps")` before capitalising, so output reads `"Streamlines synergistic solutions"` instead of `"Streamline synergistic solutions"`.

**`zod4-mock`** (library):

- `word.sentence()` delegates wholesale to `loc.formatSentence` when the active locale defines it; falls back to a surface-form 5-template path against `loc.verbs` / `loc.verbsPlural` / `loc.pronouns` / `loc.articles` / `loc.nouns` / `loc.adjectives` when absent. The library `src/` MUST NOT import from any locale package — the delegation flows solely through the typed callback (a new architectural boundary candidate for promotion to a binding rule).
- `word.adverb()` is unchanged — still a single `locPick(prng, loc.adverbs)` call. The variety win comes from locale-en shipping the derived list.

PRNG budget per call site is byte-identical to today's — one `prng.random()` per pick, then a pure-string transform with zero draws. Determinism (D4 / D10) and isomorphism (D13) preserved by construction.
