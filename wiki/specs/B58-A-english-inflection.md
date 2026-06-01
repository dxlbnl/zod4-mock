# B58-A: English inflection at generation time — verb conjugation, noun plural, adverb derivation

## Context

[B3](../backlog/doing/B3-conjugation-compression.md) — rescoped from the original
"conjugation-based word compression" framing to a **variety** lever after
[B48](B48-replace-markov-with-real-wordlists.md) made the bundle-size framing moot — surfaced
inflection-at-generation-time as the third "deliberately more realistic than faker" axis,
joining [B55](../backlog/inbox/B55-zipf-distributed-pick.md)'s Zipf-default picks and
[B54](B54-realistic-numeric-distributions.md)'s Benford-default numerics.

**Architectural revision (2026-06-01 post-checkpoint).** The earlier draft of this spec
placed the English inflection rules (`pluralize` / `conjugate` / `adverbFromAdjective`) in
`@zod4-mock/locale-core` and added a `verbLemmas?` field to `LocaleData.word` so the
library could read it. The user flagged this as the wrong boundary: **inflection categories
themselves differ per language** (en `"3ps" | "past" | "gerund" | "participle"`, nl
`"3ps" | "past_sg" | "past_pl" | "participle"`, Spanish person × number × tense × mood, …)
— there is no honest universal `Inflector` interface that every locale can satisfy. The
boundary must move: **each locale owns its own grammar**; locale-core holds **types only**;
the library delegates into a per-locale **callback** instead of importing rules from
locale-core. See the item card's `## Architecture revision (2026-06-01 post-checkpoint)`
section for the full record.

Today the leaf data generators emit bare surface forms:

- [`src/generators/data/word.ts:122-152`](../../src/generators/data/word.ts) — `sentence()`
  picks 3-person-singular present from `loc.verbs` (8 entries en) and a paired
  base-form from `loc.verbsPlural`, and emits `noun()` always singular.
- [`src/generators/data/word.ts:96-98`](../../src/generators/data/word.ts) — `adverb()`
  picks from `loc.adverbs` (8 entries en).
- [`src/generators/data/company.ts:33-44`](../../src/generators/data/company.ts) —
  `buzzPhrase()` passes the bare `buzzVerbLemmas` entry to `formatBuzzPhrase`, which
  capitalises and concatenates (`Streamline synergistic solutions`).
- [`packages/locale-en/src/locale.ts:85-95`](../../packages/locale-en/src/locale.ts) /
  `:415` / `:574-575` — the existing `formatBio` / `formatProductName` /
  `formatBuzzPhrase` locale callbacks are the pattern this card extends.

B58-A is **Card A** of the [B3 report](../research/text-generation/conjugation-compression.md)
§8 hand-off. Under the revised architecture it ships:

1. A new **per-locale** `inflect` namespace under `@zod4-mock/locale-en`, exporting
   `pluralize` / `conjugate(verb, "3ps" | "past" | "gerund" | "participle")` /
   `adverbFromAdjective`. The locale package owns its grammar. The library never
   imports it.
2. A new **type-only** locale callback on `LocaleData.word`:
   `formatSentence?: (prng: Prng, ctx?: GeneratorContext) => string`. Same shape as the
   existing `formatBio` / `formatProductName` / `formatBuzzPhrase` callbacks. Lives in
   `@zod4-mock/locale-core` types; no implementation.
3. `@zod4-mock/locale-en` implements `formatSentence`, owning the 5 sentence templates
   and the Template-2 3ps-pronoun constraint internally, composing inflected forms via
   its own private `inflect`.
4. `src/generators/data/word.ts` `sentence()` is reshaped to **delegate** to
   `loc.formatSentence` when present and fall back to the current behaviour against
   `verbs` / `verbsPlural` when absent (back-compat).
5. `adverb()` is **unchanged**; the variety win comes from locale-en deriving its larger
   `adverbs` field at module-init from `adjectives` + a small reserved closed list.
6. `formatBuzzPhrase` in locale-en is updated to wrap its `verb` argument in its own
   private `inflect.conjugate(_, "3ps")` (replaces the prior plan of an external library
   call from `buzzPhrase()`).
7. The `LocaleData.word.verbLemmas` field added in the prior spec is **dropped** — the
   library no longer reads lemmas (it delegates wholesale), so locale-en's lemma list
   becomes a private data file inside locale-en.
8. Public API on `@zod4-mock/locale-en`: `inflect` is re-exported for matcher authors
   (`import { inflect } from "@zod4-mock/locale-en"`).
9. **Reduced docs scope** (per the user). Only the cross-cutting type — the
   `LocaleData.word.formatSentence` callback — is documented in `docs/api-reference.md`,
   mirroring the existing `formatBio` / `formatBuzzPhrase` / `formatProductName`
   treatment. The locale-en-specific `inflect.*` helpers are documented inline via
   JSDoc on their exports (and optionally in locale-en's own README); they are
   **not** documented in `docs/concepts.md` or `docs/recipes.md`.

**Decisions inherited from B3 review checkpoint (2026-06-01)** — all three blocking and six
non-blocking questions are resolved; see the item card's `## Decisions` section. The three
locks that shape the spec, plus the new architectural lock:

- **Q-1**: `adverb()` derives from `adjectives` unconditionally when `adjectives.length > 0`;
  the existing `loc.adverbs` array becomes the reserved closed-list pool for
  non-adjective-derived adverbs (`here`, `now`, `then`, `there`, …). **Implementation
  under this spec**: locale-en computes `adverbs` at module init as
  `[...reserved, ...adjectives.map(inflect.adverbFromAdjective)]`; the library's
  `adverb()` is unchanged and continues to read `loc.adverbs` straight.
- **Q-2**: form choice per consumer is **always-fixed per call site** (deterministic — no
  extra `prng.random()` draws). Variety comes from picking different lemmas under one PRNG
  draw and inflecting each call site into its fixed form; not from a per-call PRNG flip.
- **Q-3**: Dutch noun gender source gates [B58-B](../backlog/inbox/B58-B-dutch-inflection.md)
  only; B58-A is **unblocked**.
- **Architectural revision (2026-06-01 post-checkpoint)**: inflection rules live
  per-locale, not in locale-core. The library delegates to `loc.formatSentence`;
  locale-en exports `inflect` publicly for matcher authors. Main `docs/` scope is
  limited to the cross-cutting callback type; locale-en's `inflect.*` is documented
  inline via JSDoc, not in main docs.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Composition with shipped Rules

- **D1** — no `any`. All inflection rules signature `(input: string) => string` (or
  `(input: string, form: …Literal…) => string`); irregular tables typed
  `Readonly<Record<string, string>>`. The `formatSentence` callback type is
  `(prng: Prng, ctx?: GeneratorContext) => string` — fully typed.
- **D4 / D10** — determinism. Each call site keeps its current PRNG budget: one
  `prng.random()` (or `prng.pickZipf` post-B55) per pick, then a pure-string transform.
  The transform consumes **zero** PRNG state. Adding the inflected `formatSentence`
  path perturbs no _other_ field's seed→value mapping; the **same** field's value
  shifts because the locale callback now derives surface forms from lemmas — a
  documented behaviour change (R11 changeset), not a determinism violation.
- **D11** — the canonical `PIPELINE` in [`src/pipeline.ts:452-460`](../../src/pipeline.ts) is
  untouched. Inflection lives **inside** the leaf data generator (`word.ts`) which
  delegates to the locale callback. The PIPELINE rungs don't see this.
- **D13** — isomorphism. Rules are pure JS — `.endsWith` / `.slice` / `.charAt` /
  template literals / plain `Record<string, string>` lookups. No `node:*`, no `Buffer`,
  no `Intl.PluralRules` (would diverge by host locale data), no `String.prototype.normalize`.
- **D14** — `generateArray` trailing pass (cap → overrides → transform) runs **above** the
  per-element generator. Inflection is per-element. The two passes do not interact; no
  change to D14.
- **Boundary rule (new candidate, see Standing-constraint analysis below)**: the
  library in `src/` **does not** import from any locale package. Locale callbacks
  (defined as type-only in `@zod4-mock/locale-core`, implemented in each locale
  package) are the only library↔locale boundary. This is exactly what permits
  per-locale grammar without forcing a universal `Inflector` interface.
- **D5** — the cross-cutting public API change is the new `LocaleData.word.formatSentence`
  callback type; `docs/api-reference.md` is updated for that in the same step.
  The locale-en `inflect.*` helpers are documented inline via JSDoc on the exported
  functions (and optionally in locale-en's own README), **not** in main `docs/`.

### Composition with sibling cards

- **[B55 (Zipf-default picks)](../backlog/inbox/B55-zipf-distributed-pick.md)** — additive,
  no merge conflict.
  - **`Prng` interface**: B55 adds `pickZipf<T>`; B58-A adds **nothing** to `Prng`. The
    additions are on disjoint methods. `pickZipf` is genuinely cross-locale (Zipf is a
    universal frequency distribution), unlike inflection.
  - **`LocaleData` additions**: B55 adds `frequencyExponent?: number` +
    `frequencyExponentOverrides?: Readonly<Record<string, number>>` at the locale root;
    B58-A adds `formatSentence?: (prng, ctx?) => string` on `LocaleData.word`. Disjoint
    properties — no merge conflict. **Note**: this card no longer shares the
    `verbLemmas` field with B55 (the field is dropped), so the previously-flagged
    "whichever lands first extends `LocaleData` first" coordination point is gone.
  - **Runtime composition**: B55's `pickZipf` picks the lemma _inside_ the locale's
    `formatSentence`; B58-A's locale-en `inflect.conjugate` then transforms it. The
    interaction is internal to locale-en. The library sees one callback call.
- **[B58-B (Dutch inflection)](../backlog/inbox/B58-B-dutch-inflection.md)** — gated on
  Q-3 OpenTaal verification; independent dispatch. Coordination points under the
  revised architecture:
  - `@zod4-mock/locale-nl` will export its own `inflect` with Dutch-specific signatures
    (e.g. `conjugate(verb, "3ps" | "past_sg" | "past_pl" | "participle")`); the shapes
    are not required to match locale-en's. There is no shared `Inflector` interface.
  - `@zod4-mock/locale-nl` will implement `formatSentence` against Dutch grammar (V2
    order, plural/singular past split, etc.) using its own private `inflect`.
  - The `LocaleData.word.formatSentence` **callback type** (a single optional field)
    is the only shared surface; both locales satisfy the same type with locale-specific
    implementations behind it. **This is what the new boundary rule purchases.**
- **[B57](../backlog/done/B54-realistic-numeric-distributions.md) (Benford on numerics)**
  — independent (numerics, not words). No interaction.
- **[B48](B48-replace-markov-with-real-wordlists.md) (real wordlists) / D13** —
  `LocaleData` ships `readonly string[]`; this card adds no new data-shape field
  (lemmas now live privately inside locale-en). No wire-shape change.

Item card:
[wiki/backlog/doing/B58-A-english-inflection.md](../backlog/doing/B58-A-english-inflection.md).
Predecessor report: [B3 — On-the-Fly Inflection](../research/text-generation/conjugation-compression.md).
GitHub issue: none.

## Requirements

### B58A-R1: `inflect.pluralize` rule in `@zod4-mock/locale-en`

The `@zod4-mock/locale-en` package **MUST** expose
`inflect.pluralize(noun: string): string` implementing regular English plural rules
(`-y` → `-ies` after consonant; `-fe` → `-ves`; `-f` → `-ves`; sibilants
`-s` / `-x` / `-z` / `-ch` / `-sh` → `+es`; `-o` after consonant → `-oes`; otherwise
`+s`) and an irregular-noun lookup table (~50 entries: `child → children`,
`foot → feet`, `mouse → mice`, …) plus an unchanged-plural table (`sheep`, `deer`,
`fish`, …). The function consumes zero PRNG state and depends on no host-locale data.

- Scenario: regular `+s`
  GIVEN `inflect.pluralize` imported from `@zod4-mock/locale-en`
  WHEN called with `"cat"`
  THEN it returns `"cats"`.
- Scenario: sibilant `+es`
  GIVEN `inflect.pluralize` imported from `@zod4-mock/locale-en`
  WHEN called with `"box"`
  THEN it returns `"boxes"`.
- Scenario: consonant + `y` → `-ies`
  GIVEN `inflect.pluralize` imported from `@zod4-mock/locale-en`
  WHEN called with `"city"`
  THEN it returns `"cities"`.
- Scenario: irregular lookup
  GIVEN `inflect.pluralize` imported from `@zod4-mock/locale-en`
  WHEN called with `"child"`
  THEN it returns `"children"`.
- Scenario: unchanged plural
  GIVEN `inflect.pluralize` imported from `@zod4-mock/locale-en`
  WHEN called with `"sheep"`
  THEN it returns `"sheep"`.

### B58A-R2: `inflect.conjugate` rule in `@zod4-mock/locale-en`

The `@zod4-mock/locale-en` package **MUST** expose
`inflect.conjugate(verb: string, form: "3ps" | "past" | "gerund" | "participle"): string`
implementing regular conjugation (`-s` / `-es` after sibilants / `-ies` after
consonant-`y` for 3ps; `+ed` with CVC-doubling and `-y → -ied` and `-e → -d` for
past/participle; `+ing` with silent-`e` drop and CVC-doubling and `-ie → -ying` for
gerund) and an irregular-verb lookup table (~180 entries from a Wiktionary-derived
public-domain compilation, pinned by the implementer at landing time per Q-A). The
function consumes zero PRNG state and depends on no host-locale data.

- Scenario: regular 3ps `+s`
  GIVEN `inflect.conjugate` imported from `@zod4-mock/locale-en`
  WHEN called with `("walk", "3ps")`
  THEN it returns `"walks"`.
- Scenario: regular 3ps sibilant `+es`
  GIVEN `inflect.conjugate` imported from `@zod4-mock/locale-en`
  WHEN called with `("go", "3ps")`
  THEN it returns `"goes"`.
- Scenario: irregular past
  GIVEN `inflect.conjugate` imported from `@zod4-mock/locale-en`
  WHEN called with `("go", "past")`
  THEN it returns `"went"`.
- Scenario: regular gerund silent-`e` drop
  GIVEN `inflect.conjugate` imported from `@zod4-mock/locale-en`
  WHEN called with `("make", "gerund")`
  THEN it returns `"making"`.
- Scenario: irregular participle
  GIVEN `inflect.conjugate` imported from `@zod4-mock/locale-en`
  WHEN called with `("write", "participle")`
  THEN it returns `"written"`.

### B58A-R3: `inflect.adverbFromAdjective` rule in `@zod4-mock/locale-en`

The `@zod4-mock/locale-en` package **MUST** expose
`inflect.adverbFromAdjective(adj: string): string` implementing `-ly` derivation with
closed-form rules (`-y` after consonant → `-ily`; `-le` → `-ly` with the silent-`e`
drop; `-ic` → `-ically`; otherwise `+ly`) and a small irregular-adverb table
(~10 entries: `good → well`, `fast → fast`, `hard → hard`, …). The function consumes
zero PRNG state and depends on no host-locale data.

- Scenario: `-y → -ily`
  GIVEN `inflect.adverbFromAdjective` imported from `@zod4-mock/locale-en`
  WHEN called with `"easy"`
  THEN it returns `"easily"`.
- Scenario: `-le → -ly`
  GIVEN `inflect.adverbFromAdjective` imported from `@zod4-mock/locale-en`
  WHEN called with `"simple"`
  THEN it returns `"simply"`.
- Scenario: `-ic → -ically`
  GIVEN `inflect.adverbFromAdjective` imported from `@zod4-mock/locale-en`
  WHEN called with `"dramatic"`
  THEN it returns `"dramatically"`.
- Scenario: irregular lookup
  GIVEN `inflect.adverbFromAdjective` imported from `@zod4-mock/locale-en`
  WHEN called with `"good"`
  THEN it returns `"well"`.
- Scenario: regular `+ly`
  GIVEN `inflect.adverbFromAdjective` imported from `@zod4-mock/locale-en`
  WHEN called with `"quick"`
  THEN it returns `"quickly"`.

### B58A-R4: `LocaleData.word.formatSentence?` locale callback type

The `LocaleData.word` interface in
[`packages/locale-core/src/types.ts`](../../packages/locale-core/src/types.ts) **MUST**
gain an optional callback field

```ts
formatSentence?: (prng: Prng, ctx?: GeneratorContext) => string;
```

mirroring the signature style of the existing `person.formatBio`,
`commerce.formatProductName`, and `company.formatBuzzPhrase` locale callbacks. The type
is added to `@zod4-mock/locale-core`; no implementation is added in this package. The
field is opt-in by presence — locales that ship it own sentence composition; locales
that omit it fall back to the library's default (R6). Type-checking remains valid both
with and without the field populated.

- Scenario: type-level field populated
  GIVEN a TypeScript file importing `LocaleData` from `@zod4-mock/locale-core`
  WHEN it constructs a `LocaleData` literal whose `word` block sets
  `formatSentence: (prng, ctx) => "stub"`
  THEN the file type-checks without error.
- Scenario: type-level field omitted
  GIVEN a TypeScript file importing `LocaleData` from `@zod4-mock/locale-core`
  WHEN it constructs a `LocaleData` literal whose `word` block omits `formatSentence`
  entirely
  THEN the file type-checks without error.

### B58A-R5: `@zod4-mock/locale-en` ships `formatSentence` with the 5 templates

The `@zod4-mock/locale-en` package **MUST** populate `word.formatSentence` on its
exported `LocaleData` with the five English sentence templates currently implemented
inline in [`src/generators/data/word.ts:122-152`](../../src/generators/data/word.ts),
ported to use locale-en's own private `verbLemmas` data file (top-50 common-verb list,
provenance header per Q-A) and to compose surface forms via locale-en's private
`inflect`:

- `vrb()` slots → `inflect.conjugate(prng.pick(verbLemmas), "3ps")`.
- `vrbp()` slots → same `inflect.conjugate(_, "3ps")` wrap on a fresh lemma pick (Q-2
  always-fixed per call site).
- The fixed "pluralised noun" slot per template → `inflect.pluralize(noun)`.
- Template 2's pronoun slot → picked from a 3ps-singular closed list shipped inline in
  `formatSentence` (`["he", "she", "it"]`, capitalised at the sentence start) — never
  from the full `loc.pronouns` array, so subject–verb agreement holds.

Total PRNG budget per call **MUST** equal today's budget (one `prng.random()` per leaf
slot plus the template-pick draw) — no extra draws introduced by inflection.

- Scenario: en formatSentence emits a 3ps-conjugated verb
  GIVEN a `Prng` seeded `42` and the exported `en: LocaleData` from
  `@zod4-mock/locale-en`
  WHEN `en.word.formatSentence!(prng)` is called
  THEN the returned sentence contains at least one 3ps-conjugated verb token (the
  surface form of an `inflect.conjugate(lemma, "3ps")` call against an entry of
  locale-en's private `verbLemmas`) and contains no bare-infinitive verb token in any
  verb slot.
- Scenario: Template 2 pronoun is 3ps-singular
  GIVEN a `Prng` seeded such that the template-pick draw selects Template 2 (the
  `[Pronoun] [Verb] [Article] [Adjective] [Noun]` shape) and the exported
  `en: LocaleData`
  WHEN `en.word.formatSentence!(prng)` runs
  THEN the sentence's first whitespace-separated token (the capitalised pronoun) is
  one of `"He"` / `"She"` / `"It"` — never `"I"` / `"You"` / `"We"` / `"They"`.

### B58A-R6: library `sentence()` delegates to `loc.formatSentence`

[`src/generators/data/word.ts`](../../src/generators/data/word.ts) `sentence()` **MUST**
detect the presence of `loc.formatSentence` on the active locale and, when present,
return `loc.formatSentence(prng, ctx)` directly without running the inline template
machinery. When `loc.formatSentence` is absent, `sentence()` **MUST** fall back to the
existing 5-template English-shape behaviour against `loc.verbs` / `loc.verbsPlural` (the
back-compat path for non-locale-en consumers and ad-hoc `LocaleData` literals in tests).
The library code in `src/` **MUST NOT** import from any locale package — neither
`@zod4-mock/locale-en` nor any other locale-shipping package — in service of this
requirement; the delegation is by callback only.

- Scenario: custom locale's `formatSentence` is used verbatim
  GIVEN a custom `LocaleData` literal whose `word.formatSentence` is set to
  `(_prng) => "SYNTHETIC"` (all other `word` fields populated as a minimal stub)
  WHEN `sentence(prng, { locale: customLoc })` runs
  THEN the returned string is exactly `"SYNTHETIC"`.
- Scenario: missing `formatSentence` falls back to inline templates
  GIVEN a custom `LocaleData` literal whose `word.formatSentence` is omitted and whose
  `word.verbs = ["is"] as const`, `word.verbsPlural = ["are"] as const`, with the
  remaining `word` fields populated as a minimal stub
  WHEN `sentence(prng, { locale: customLoc })` runs
  THEN the returned string is non-empty and contains exactly one verb token drawn
  from `["is", "are"]` (the surface-form fallback path), with no inflection rule
  applied to it.

### B58A-R7: locale-en `adverbs` is derived from `adjectives` + reserved list

The `@zod4-mock/locale-en` package **MUST** populate its exported `LocaleData.word.adverbs`
at module initialisation as `[...reserved, ...adjectives.map(inflect.adverbFromAdjective)]`,
where `reserved` is the existing 8-entry closed list of non-adjective-derived adverbs
(`here`, `now`, `then`, `there`, …) currently shipped in locale-en. The library's
`adverb()` generator at
[`src/generators/data/word.ts:96-98`](../../src/generators/data/word.ts) **MUST NOT** be
modified by this card — it stays a single `locPick(prng, loc.adverbs)` call, satisfying the
boundary rule (no library import from locale packages).

- Scenario: en adverbs include reserved + derived
  GIVEN the exported `en: LocaleData` from `@zod4-mock/locale-en`
  WHEN the test reads `en.word.adverbs`
  THEN it has length ≥ 3000 (reflecting the derived-from-adjectives expansion over the
  prior 8-entry list) AND contains the literal `"now"` (a reserved entry) AND contains
  at least one entry equal to `inflect.adverbFromAdjective(adj)` for some `adj` in
  `en.word.adjectives`.

### B58A-R8: locale-en `formatBuzzPhrase` conjugates verb to 3ps

The `formatBuzzPhrase` callback exported by `@zod4-mock/locale-en` in
[`packages/locale-en/src/locale.ts:574-575`](../../packages/locale-en/src/locale.ts)
**MUST** wrap its `verb` argument in locale-en's own private
`inflect.conjugate(verb, "3ps")` before composing the final phrase. The chosen form is
fixed at `"3ps"` per Q-2 (no PRNG-driven flip between bare / gerund / 3ps). The library's
`buzzPhrase()` at
[`src/generators/data/company.ts:33-44`](../../src/generators/data/company.ts) is
**not** modified — it continues to pass the bare lemma to the locale callback. The PRNG
budget is unchanged.

- Scenario: en buzz-phrase emits 3ps verb
  GIVEN the exported `en: LocaleData` from `@zod4-mock/locale-en`
  WHEN `en.company.formatBuzzPhrase("streamline", "synergistic", "solutions")` is
  called
  THEN the returned phrase is exactly `"Streamlines synergistic solutions"` (capitalised
  3ps form, not the bare lemma `"Streamline …"`).

### B58A-R9: `@zod4-mock/locale-en` exports `inflect` publicly

The `@zod4-mock/locale-en` package's public entrypoint
(`packages/locale-en/src/index.ts`) **MUST** re-export the `inflect` namespace so matcher
authors can import it directly for use in custom generators via `withGenerators`:

```ts
import { inflect } from "@zod4-mock/locale-en";
inflect.pluralize("city"); // "cities"
```

The export is stable public API for locale-en from day one. (locale-core does **not**
export an `inflect` of any kind — see R12.)

- Scenario: matcher author can import `inflect` from locale-en
  GIVEN the published `@zod4-mock/locale-en` package
  WHEN a consumer does `import { inflect } from "@zod4-mock/locale-en"` and reads
  `inflect.pluralize`, `inflect.conjugate`, `inflect.adverbFromAdjective`
  THEN all three are `function`-typed and callable, returning the same string outputs
  as the corresponding R1 / R2 / R3 scenarios for matching inputs.

### B58A-R10: `LocaleData.word.verbsPlural` marked `@deprecated`

The `verbsPlural` field on `LocaleData.word` in
[`packages/locale-core/src/types.ts`](../../packages/locale-core/src/types.ts) **SHOULD**
carry a JSDoc `@deprecated` tag pointing consumers to `formatSentence` as the new owner
of sentence assembly (which folds in plural-subject verb forms internally). The field is
**not** removed in this card; removal is a future major (Q-5 lock). The reviewer
verifies the tag presence by reading the source.

- Scenario: deprecation tag is present in the type definition
  GIVEN the source file `packages/locale-core/src/types.ts`
  WHEN the reviewer reads the lines defining the `verbsPlural` member of
  `LocaleData.word`
  THEN the immediately preceding JSDoc block contains the literal token `@deprecated`
  and a one-line migration note referencing `formatSentence`.

### B58A-R11: documentation, changeset, and snapshot re-pin

The single landing commit **MUST** include:

1. An update to [`docs/api-reference.md`](../../docs/api-reference.md) — a brief
   paragraph documenting the new `LocaleData.word.formatSentence` callback type and
   pointing readers at the existing `formatBio` / `formatProductName` /
   `formatBuzzPhrase` entries as the shape model. No other docs file in `docs/` is
   modified by this card (per the architectural revision's docs-scope reduction:
   locale-package-internal `inflect.*` is documented inline via JSDoc on its exports,
   not in main `docs/`).
2. JSDoc on the exported functions `inflect.pluralize`, `inflect.conjugate`, and
   `inflect.adverbFromAdjective` in `@zod4-mock/locale-en` — each with a one-paragraph
   summary, the rule set, and an example. If `@zod4-mock/locale-en` ships its own
   README, the README **MAY** also gain a brief "Inflection helpers" section linking
   to the JSDoc; if it does not, the JSDoc alone is sufficient.
3. A changeset at `.changeset/b58-a-english-inflection.md` with `minor` bumps on
   `zod4-mock` + `@zod4-mock/locale-core` + `@zod4-mock/locale-en` (Q-7).
4. A re-pin of any integration-test fixtures
   ([`tests/integration/`](../../tests/integration/)) whose `sentence()` /
   `buzzPhrase()` outputs shift under the inflection wrap (Q-8 — same-commit audit per
   the B51 precedent). `adverb()` outputs may also shift if a snapshot fixture happens
   to land on a now-derived entry; included in the same audit.

The reviewer verifies items 1-4 are present in the diff before approving the item.

- Scenario: docs / changeset / re-pin all present
  GIVEN the landing commit on the B58-A branch
  WHEN the reviewer inspects the diff
  THEN it contains: an update to `docs/api-reference.md` covering
  `LocaleData.word.formatSentence`; JSDoc on the three `inflect.*` exports in
  `@zod4-mock/locale-en`; a new file `.changeset/b58-a-english-inflection.md` whose
  frontmatter bumps `zod4-mock` + `@zod4-mock/locale-core` + `@zod4-mock/locale-en` at
  `minor`; and updated fixture values for any integration-test snapshot that consumed
  `sentence()` / `buzzPhrase()` / `adverb()`. No changes are made to
  `docs/concepts.md` or `docs/recipes.md`.

### B58A-R12: `@zod4-mock/locale-core` does NOT export `inflect`

The `@zod4-mock/locale-core` package's public entrypoint
(`packages/locale-core/src/index.ts`) **MUST NOT** export an `inflect` namespace, nor
contain any English-specific (or any other locale-specific) inflection-rule
implementation. The package is restricted to TYPES for B58-A — the new
`LocaleData.word.formatSentence?` callback type and the existing `Prng` /
`GeneratorContext` / `LocaleData` types. Any `packages/locale-core/src/inflect/`
directory or file (left behind from the prior architectural draft) **MUST** be
removed. The reviewer verifies by searching the package's `src/` tree.

- Scenario: locale-core src contains no inflect path
  GIVEN the source tree at `packages/locale-core/src/`
  WHEN the reviewer searches the tree for any file path matching the glob
  `**/inflect*` or any directory named `inflect`
  THEN the search returns zero matches.
- Scenario: locale-core entrypoint exports no `inflect` symbol
  GIVEN the source file `packages/locale-core/src/index.ts`
  WHEN the reviewer reads the file
  THEN no `export` statement names `inflect` (neither as a named export, a re-export,
  nor a namespace re-export from a child module).

## Minimum tests directive

Per [[feedback-minimal-tests]] and [[feedback-tests-test-behavior]]:

- **One test file**: `tests/unit/B58-A-english-inflection.test.ts`.
- **Test-bearing R-IDs (9 `it(...)` blocks)**:
  - R1 — covers all five `pluralize` scenarios in a single `it` block.
  - R2 — covers all five `conjugate` scenarios in a single `it` block.
  - R3 — covers all five `adverbFromAdjective` scenarios in a single `it` block.
  - R4 — type-level assertion that a `LocaleData` literal with `formatSentence` set
    and one with it omitted both type-check. Written as a `// @ts-expect-error`-free
    compile-only sentinel in the test file (no runtime expect), or skipped at runtime
    if the test runner doesn't surface type errors as failures.
  - R5 — covers both `formatSentence` scenarios (3ps-conjugated verb, Template 2 3ps
    pronoun) in a single `it` block.
  - R6 — covers both delegation scenarios (synthetic `formatSentence` returns
    verbatim; missing `formatSentence` falls back to inline templates) in a single
    `it` block.
  - R7 — asserts `en.word.adverbs` length ≥ 3000, contains `"now"`, and contains at
    least one derived `-ly` form for some adjective entry.
  - R8 — asserts `en.company.formatBuzzPhrase("streamline", "synergistic", "solutions")`
    equals `"Streamlines synergistic solutions"`.
  - R9 — asserts that `import { inflect } from "@zod4-mock/locale-en"` exposes
    `pluralize` / `conjugate` / `adverbFromAdjective` as functions with the same
    outputs as R1 / R2 / R3 for matching inputs.
- **Reviewer-only R-IDs (no test)**: R10 (`@deprecated` tag — reviewer reads the
  types file; the typechecker does not enforce JSDoc tags, so an automated assertion
  is meaningless); R11 (docs / changeset / snapshot re-pin — reviewer reads the diff);
  R12 (no `inflect` in locale-core — reviewer searches the source tree using
  `Grep` / `Glob`, no runtime assertion needed and `import { inflect } from
"@zod4-mock/locale-core"` failing to type-check is the structural guarantee).

The total expected new unit-test count for this card is **9**.

## Out of scope

- **Dutch inflection** — [B58-B](../backlog/inbox/B58-B-dutch-inflection.md). Dutch
  inflection categories differ from English (en `"3ps" | "past" | "gerund" |
"participle"` vs nl `"3ps" | "past_sg" | "past_pl" | "participle"`); locale-nl will
  ship its own `inflect` with its own shape under the boundary rule, **not** a shared
  cross-locale `Inflector` interface.
- **A universal `Inflector` interface in `@zod4-mock/locale-core`** — architecturally
  rejected at the 2026-06-01 post-checkpoint review: inflection categories themselves
  differ per language, so no honest universal interface exists. Replaced by the
  per-locale callback (`formatSentence`) pattern this spec ships.
- **PRNG-driven form choice** — explicitly rejected by Q-2 (always-fixed per call site).
- **Removing `verbsPlural`** — kept with `@deprecated`; removal is a future major.
- **`bio()` inflection** — `bio()` and `formatBio` are unchanged in this card (B3
  report §1.5 flagged `bio()` as low realism gap; the three templates already read
  naturally with their hand-templated "specializing" / "Working" surface forms).
- **Main-`docs/` deep dive on `inflect.*` helpers** — per the docs-scope reduction
  (locale-package-internal API). `inflect.*` is documented inline via JSDoc on the
  exported functions (and optionally in locale-en's own README). `docs/concepts.md`
  and `docs/recipes.md` are not modified by this card.
- **`LocaleData.word.verbLemmas` field** — dropped vs. the prior draft. The library
  no longer reads lemmas (it delegates to `formatSentence`); locale-en's lemma list
  is private data inside locale-en, not exposed on `LocaleData`.
- **Engine / PIPELINE / `generateArray` changes** — none. `src/pipeline.ts` and the
  `generateArray` trailing pass (D14) are untouched.
- **`Prng` interface changes** — none. `Prng` gains no methods in this card.
- **`commerce.productName()` / `formatProductName`** — out of scope for B58-A
  (B3 report §1.4 — the en gap is low; the nl `+"en"` bug is closed under
  [B58-B](../backlog/inbox/B58-B-dutch-inflection.md)).
- **Comparative / superlative adjective forms** — B3 report §1.1 ("low leverage" for en);
  not in this card.
- **`pronouns` object / possessive expansion** — orthogonal to inflection rules.
- **Re-sourcing the `nouns` / `adjectives` corpora** — B51 Q-4 follow-up (SUBTLEX / FRAQ
  investigation).

## Open questions

- **None blocking.** All three B3 blocking questions (Q-1 unconditional adverb derivation,
  Q-2 always-fixed per call site, Q-3 gates B58-B not B58-A) are locked in the item
  card, and the post-checkpoint architectural revision (per-locale inflection +
  `formatSentence` callback + docs-scope reduction) is also locked by the user. The
  spec proceeds to the implementer.

**Non-blocking** (recorded; the item proceeds):

- **Q-A (non-blocking)** — Which specific public-domain compilation does the implementer
  pin for the ~180-entry irregular-verb table in R2? Candidates: Wiktionary "English
  irregular verbs", the Oxford "List of irregular verbs" CC-BY excerpt. Resolution:
  implementer's choice at landing, captured as a one-line provenance header in the
  locale-en data file backing the verb-irregulars table per the B48 convention.
  Recorded; does not block spec progression because the rule API (R2) is
  source-agnostic.

**Dropped vs. prior draft** (recorded here for the audit trail; do not act on these):

- ~~Q-B (per-template `sentence()` slot-fixing assignment)~~ — under the revised
  architecture the assignment lives wholly inside locale-en's `formatSentence`
  implementation. It is no longer a spec-level concern; the implementer fixes per
  template at landing, and R5's observable test asserts the effect (3ps verb token
  present; Template 2 pronoun is 3ps-singular) without pinning a specific
  template-by-template assignment. Dropped from this section.
- ~~Q-C (B55 / B58-A landing order)~~ — under the revised architecture B55 and B58-A
  no longer share any `LocaleData` field (`verbLemmas` is dropped; B58-A's new
  surface area is `formatSentence`, disjoint from B55's `frequencyExponent*`). The
  ordering coordination point is gone. Dropped from this section.

## Standing-constraint analysis

Per the user's architectural finding, this card establishes a new standing constraint
that future locale work must obey. **Recommendation: promote.**

**Candidate rule (proposed for the next D-number)**:

> _"Library code in `src/` MUST NOT import from any locale package
> (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`, …). The only library↔locale
> boundary is the set of optional locale callbacks (`formatBio`, `formatBuzzPhrase`,
> `formatProductName`, `formatSentence`, …) typed in `@zod4-mock/locale-core` and
> implemented in each locale package. `@zod4-mock/locale-core` itself MUST contain
> types only — no English-specific (or any locale-specific) rule implementations."_

**Rationale**: this is the structural rule the architectural revision establishes.
Without it a future agent could resurrect the locale-core-knows-English pattern (it's
the obvious shortcut every time the library wants a string-shape helper), forcing a
universal interface back onto languages whose grammar categories don't fit. The rule
encodes _why_ the per-locale callback pattern exists, not just _that_ it exists. It
is exactly the kind of "would an unrelated future item need to know this?" test that
gates inclusion in `decisions.md`.

**Procedure** (per `wiki/decisions.md` format): the rationale is appended to
`wiki/decisions.md` at landing time by the implementer (the agent that materialised
the structural change); the reviewer confirms a decision entry exists; the manager
promotes it to a one-line rule in `wiki/architecture.md`'s **Rules** section as the
next free `D-<n>` (currently → D15) when the item is marked done.

**Other shipped Rules remain unchanged.** The inflection requirements (R1-R3 rule
purity, R5-R8 consumer wiring) compose cleanly with existing rules:

- **D1** — no `any` (rule signatures are `(string) => string` / `(string, Literal) =>
string`; lookup tables are `Readonly<Record<string, string>>`; `formatSentence` is
  fully typed).
- **D4 / D10** — determinism preserved; inflection consumes zero PRNG state, total
  budget per call site unchanged.
- **D11** — canonical `PIPELINE` unchanged; inflection lives inside the locale
  callback, downstream of the rungs.
- **D13** — isomorphism preserved; pure-JS rules, no `node:*` / `Buffer` /
  `Intl`-locale.
- **D14** — `generateArray` trailing pass unchanged.
