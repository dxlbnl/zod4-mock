# B55: Zipf-distributed pick — `prng.pickZipf`, `frequencyExponent` config, per-corpus map, freq-sort retrofit

## Context

Realism axis for open, frequency-ranked locale corpora. Today the data-generator call
sites that draw from open word/name lists use `prng.pick(items)` —
[`src/prng.ts:91-93`](../../src/prng.ts), `items[Math.floor(rand() * items.length)]`
— which is uniform over the array. For corpora that are sorted descending by real
frequency (e.g. `lastNames` via the US Census `count` column), uniform sampling spreads
draws evenly across the long tail; for heads like "smith"/"johnson" that should
dominate, this reads as unrealistic and diverges from real distributions in `unique`
generation runs in a different direction than the data ordering implies.

B55 implements the **Card A** hand-off from
[B51 research §10](../research/text-generation/locale-list-size-targets.md#10-implementation-card-hand-off-summary):
add a closed-form-inverse-CDF Zipf draw on the `Prng` interface, expose a locale-data
config (`frequencyExponent` + per-corpus overrides) so each corpus picks its own `s`,
swap data-generator call sites on **open** corpora to the new draw, and — in the same
commit, per locked decision Q-2 — retrofit the alphabetical `.sort()` on first-name
fetch scripts to descending-by-`count` so the new default behaves correctly from day
one. Closed/enumerable sets (`states`, `months`, `weekdays`, …) stay on uniform
`prng.pick`.

This is the **behavior-change commit**: the seed → value mapping shifts for every
open-corpus field, hence the 0.x minor bump and the integration-snapshot re-pin
in the same commit (per B39 / B48 precedent).

**Sibling realism axis:** [B54](B54-realistic-numeric-distributions.md) applies the
same "closed-form inverse-CDF per field" framing to numerics. Independent — no
composition, no shared surface beyond the `Prng` interface itself.

**Sibling sentence work:** [B58-A](B58-A-english-inflection.md) — independent.
`formatSentence` does its own picking via the locale callback and does not collide with
`frequencyExponent` (a `formatSentence`-owning locale picks its templates and lemmas
however it likes; if it wants Zipf it calls `prng.pickZipf` itself).

**D15 composition:** the library reads locale fields only via `LocaleData` (the
locale-core type), never by importing a locale package. Per-locale `s` values
flow purely through the new `frequencyExponent` / `frequencyExponentOverrides`
fields of `LocaleData`. No new library↔locale boundary.

Item card:
[wiki/backlog/doing/B55-zipf-distributed-pick.md](../backlog/doing/B55-zipf-distributed-pick.md).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Decisions (locked in from B51 review checkpoint, 2026-06-01)

These are decided. The spec encodes them; the test-writer and reviewer do not
re-debate.

- **B51 Q-1 — `s` ground-truth source.** Accept the literature `s` defaults from
  [B51 report §2.3](../research/text-generation/locale-list-size-targets.md#23-recommended-defaults-per-corpus-both-locales).
  Reload SSA / Census / CBS `count` columns at retrofit time; do **not** re-fit `s`
  empirically from samples.
- **B51 Q-2 — freq-sort retrofit policy.** Land the freq-sort retrofit on first-name
  corpora in the **same commit** as `pickZipf` + `frequencyExponent`. Splitting forces
  a double snapshot re-pin with no realism gap benefit.

## Requirements

### B55-R1: `Prng.pickZipf` closed-form inverse-CDF draw

The `Prng` interface **MUST** gain a `pickZipf<T>(items: readonly T[], s: number): T`
method whose index is computed by a single closed-form inverse-CDF on **one**
`prng.random()` draw — no rejection sampling, no retries, no fallback path — using
only `Math.pow` / `Math.floor` / `Math.max` (D4 / D10 / D13 preserved).

The formula resolves the index `i ∈ [0, N)` for `u = prng.random()` and `N =
items.length` as
([B51 report §2.1](../research/text-generation/locale-list-size-targets.md#21-what-zipf-default-means-for-a-freq-sorted-list)):

```
                ⎧ floor((N + 1)^u) − 1                              if s = 1
  rawIndex   =  ⎨ floor(1 + u·N)   − 1                              if s = 0
                ⎩ floor([1 + u·((N + 1)^(1−s) − 1)]^(1/(1−s))) − 1  otherwise
  i          =  max(0, min(rawIndex, N − 1))
```

The `s = 0` branch **MUST** be index-equivalent to `prng.pick(items)` for the same
PRNG state (`floor(1 + u·N) − 1 ≡ floor(u·N)` for `u ∈ [0, 1)`, matching `src/prng.ts:91-93`).

- Scenario: `s = 0` reproduces `prng.pick`
  GIVEN two PRNG instances seeded with the same seed (e.g. `42`) and the array
  `["a","b","c","d","e","f","g","h"]`
  WHEN one calls `prng.pickZipf(items, 0)` and the other calls `prng.pick(items)`
  THEN both return the same element and have consumed the same number of `random()`
  draws (one).

- Scenario: single PRNG draw, no rejection loop
  GIVEN a PRNG whose `random()` is observed via a counter (e.g. wrapping `random`
  to increment a counter on each call)
  WHEN `prng.pickZipf(["a","b","c","d","e"], 1)` is called once
  THEN the counter reads exactly `1`.

- Scenario: index stays in range for boundary `u`
  GIVEN a deterministic `random()` that returns a value arbitrarily close to `1`
  (e.g. `0.999999`)
  WHEN `prng.pickZipf(items, 1)` is called on a 10-element array
  THEN the returned element is `items[9]` (i.e. the final index, not undefined and
  not out of bounds).

- Scenario: Zipf-1 favours the head
  GIVEN a PRNG seeded with `42` and the array `["a","b","c","d","e","f","g","h","i","j"]`
  (N = 10) sampled 1000 times with `pickZipf(items, 1)`
  THEN the count of `"a"` (head) is strictly greater than the count of `"j"` (tail),
  and the count of `"a"` exceeds `N/2 · (1/N) · 1000 = 50` (i.e. visibly head-skewed
  beyond uniform's expected 100 per bucket).

### B55-R2: `LocaleData.frequencyExponent` and `frequencyExponentOverrides` fields

`LocaleData` **MUST** gain two new optional fields, additive only (no removals, no
renames):

```ts
frequencyExponent?: number;
frequencyExponentOverrides?: Readonly<Record<string, number>>;
```

The locale-level default `1.0` is applied at the **data-generator call site**
(`overrides[fieldName] ?? locale.frequencyExponent ?? 1.0`), **not** as a typed
default on the interface, so custom locales authored via `extend()` without these
fields continue to compile and behave unchanged (per
[B51 Q-11](../research/text-generation/locale-list-size-targets.md#82-non-blocking-recommendations-baked-in)).

- Scenario: type addition is additive
  GIVEN a custom locale created via `extend(en, { … })` that does not set either
  new field
  WHEN the resulting `LocaleData` is consumed by the library
  THEN it type-checks and behaves identically to a locale where
  `frequencyExponent` is `1.0` (i.e. the locale-level default is engine-resolved,
  not type-resolved).

- Scenario: per-corpus override takes precedence
  GIVEN a locale with `frequencyExponent: 1.0` and
  `frequencyExponentOverrides: { lastNames: 0.7 }`
  WHEN a data generator resolves the effective `s` for `lastNames`
  THEN the resolved value is `0.7`.

- Scenario: locale default applies when no override
  GIVEN a locale with `frequencyExponent: 0.9` and no
  `frequencyExponentOverrides`
  WHEN a data generator on an **open** corpus resolves its `s`
  THEN the resolved value is `0.9`.

### B55-R3: Open-corpus data-generator call sites use `pickZipf`

Data-generator call sites that draw from **open** corpora — as classified in
[B51 report §1](../research/text-generation/locale-list-size-targets.md#1-full-per-field-inventory)
— **MUST** call `prng.pickZipf(items, s)` instead of `prng.pick(items)`, where
`s = overrides[corpusName] ?? locale.frequencyExponent ?? 1.0`. Closed /
enumerable call sites (`states`, `months`, `weekdays`, `continents`,
`currencies`, `bankCodes`, `bicLocations`, `landlinePrefixes`, `genders`,
`suffixes`, `prefixes.*`, `cityPrefixes`, `cityCores`, `streetSuffixes`,
`buildingNumberSuffixes`, `articles`, `conjunctions`, `pronouns`,
`interjections`, `materials`, `transactionTypes`, `company.prefixes`,
`company.suffixes`, `jobTypes`, `directions`, `cardinalDirections`,
`ordinalDirections`) **MUST** continue to call `prng.pick(items)` directly.

- Scenario: open-corpus call site routes through `pickZipf`
  GIVEN a locale with `frequencyExponentOverrides: { lastNames: 1.0 }` and a
  `lastNames` corpus whose head is `["smith","johnson","williams", … ]`
  (Census-descending, current shipped order), and a deterministic PRNG
  WHEN a data generator that picks a surname is invoked 200 times against this
  locale
  THEN the resulting distribution of returned surnames has `"smith"` strictly
  more frequent than `"williams"` (head-skew, not uniform), and the exact
  surname returned on any given draw is the value produced by
  `prng.pickZipf(lastNames, 1.0)` for that PRNG state.

- Scenario: closed-corpus call site stays on `prng.pick`
  GIVEN any locale and a closed corpus (e.g. `address.states` with 50 entries
  for `en`)
  WHEN a data generator that picks a state is invoked for a given PRNG state
  THEN the returned value equals `prng.pick(states)` for that PRNG state (and
  not the value `prng.pickZipf(states, locale.frequencyExponent ?? 1.0)` would
  produce — i.e. the corpus is sampled uniformly regardless of
  `locale.frequencyExponent`).

### B55-R4: Per-corpus `s` overrides land in each locale's `extend()`

Each locale **MUST** ship `frequencyExponentOverrides` with the per-corpus `s` values
from
[B51 report §2.3](../research/text-generation/locale-list-size-targets.md#23-recommended-defaults-per-corpus-both-locales),
and `frequencyExponent: 1.0` as the locale-level default. The per-corpus map
**MUST** include at least the following keys with these exact values:

| Corpus key (override)    | `s`   |
| ------------------------ | ----- |
| `lastNames`              | `0.7` |
| `firstNamesMale`         | `0.9` |
| `firstNamesFemale`       | `0.9` |
| `nouns`                  | `0`   |
| `adjectives`             | `0`   |
| `buzzAdjectives`         | `0.5` |
| `buzzNouns`              | `0.5` |
| `buzzVerbLemmas`         | `0.5` |
| `catchPhraseAdjectives`  | `0.5` |
| `catchPhraseDescriptors` | `0.5` |
| `catchPhraseNouns`       | `0.5` |

All other open corpora inherit the locale-level `1.0`. Closed-corpus keys
**MUST NOT** appear in the override map (the data generator routes them through
`prng.pick` regardless, per R3, so listing them would be dead config).

Reviewer-verified: this requirement is structural, not behavioural; R3's scenario
exercises the path end-to-end for `lastNames` and is sufficient as the single test
per [[feedback-minimal-tests]].

- Scenario: en locale ships the expected overrides
  GIVEN the shipped `en` locale object
  WHEN `en.frequencyExponentOverrides?.lastNames` is read
  THEN the value is `0.7`; and the locale-level `en.frequencyExponent` is `1.0`.

### B55-R5: Freq-sort retrofit on first-name fetch scripts

The fetch scripts that build the first-name corpora **MUST** sort by descending
real-frequency `count` instead of alphabetical when committed in the same
implementation commit as R1–R4. Specifically:

- [`packages/locale-en/scripts/fetch-data.ts:135-136`](../../packages/locale-en/scripts/fetch-data.ts)
  — `firstNamesMale = [...males].sort();` and `firstNamesFemale = [...females].sort();`
  **MUST** become a descending-by-SSA-`count` sort that preserves only names whose
  count column resolved (the current `if (rawSex === "boy") males.add(rawName);`
  ingestion path must capture the count alongside the name).
- [`packages/locale-nl/scripts/fetch-data.ts:143`](../../packages/locale-nl/scripts/fetch-data.ts)
  — the trailing `.sort()` inside `cleanList(...)` for cleaned Dutch first-name lists
  **MUST** become a descending-by-CBS-`Mannen` (for male) / `Vrouwen` (for female)
  count sort. The `cleanList` helper currently takes only `string[]`; the call sites at
  lines 145–146 currently throw away the count when they `map((n) => n.Voornaam)` — the
  retrofit MUST pass the count through so `cleanList` can sort by it.
- The committed data files
  ([`packages/locale-en/src/data/first-names-male.ts`](../../packages/locale-en/src/data/first-names-male.ts),
  `first-names-female.ts`, `packages/locale-nl/src/data/first-names-*.ts`)
  **MUST** be re-run and committed in the same commit so the shipped arrays match.
- `lastNames` fetch logic at
  [`packages/locale-en/scripts/fetch-data.ts:167`](../../packages/locale-en/scripts/fetch-data.ts)
  (`rows.sort((a, b) => b.count - a.count)`) is **already correct** and **MUST NOT** be
  modified.
- `nouns` / `adjectives` (dwyl / OpenTaal) keep their alphabetical source order; their
  `s = 0` override from R4 compensates so behaviour on those corpora remains uniform.

- Scenario: en first-name corpora ship in descending-frequency order
  GIVEN the post-retrofit shipped `firstNamesMale` array from
  `packages/locale-en/src/data/first-names-male.ts`
  WHEN the first three entries are read
  THEN they correspond to the SSA top-3 male names (frequency-descending), not the
  alphabetical leaders `["aaden", "aarav", "aaron"]` that the pre-retrofit
  alphabetical `.sort()` produced.

- Scenario: en `lastNames` order is preserved (regression guard)
  GIVEN the post-commit shipped `lastNames` array
  WHEN the first three entries are read
  THEN they are `["smith", "johnson", "williams"]` (the Census top-3, unchanged
  from pre-commit).

### B55-R6: `unique` contexts auto-flatten to `s = 0`

When a `pickZipf` call resolves inside a `unique`-draw retry loop (the engine
code path used by `world.get` predicate matching and other unique-context
generation paths — see
[B51 report §7.1](../research/text-generation/locale-list-size-targets.md#71-interaction-with-b8-unique--worldget)),
the effective `s` **MUST** be `0` for the duration of that loop regardless of
the locale's configured `frequencyExponent` or per-corpus override. The
auto-flatten is hard-coded with no opt-out (locked decision Q-9).

The spec is mechanism-agnostic: the implementer chooses how the unique-loop
context is signalled to the `pickZipf` resolution layer (a push/pop helper on
the `Prng` instance mirroring
[B65's `withEffectiveLocale`](../decisions.md), a `ctx.unique` flag threaded
through the data-generator context, or an equivalent). The observable
invariant is the same: every `pickZipf` call inside a unique-draw loop behaves
as if `s = 0`.

- Scenario: unique loop flattens Zipf-1 lastNames to uniform
  GIVEN a locale with `frequencyExponentOverrides: { lastNames: 1.0 }`, a
  `lastNames` array of `N = 10` entries in descending-frequency order, and a
  schema that requests `unique` last-name draws via `world.get` semantics
  WHEN 8 distinct surnames are requested in a single `unique` context
  THEN every surname returned is one that `prng.pickZipf(lastNames, 0)` would
  produce for the per-attempt PRNG state (equivalently: matches `prng.pick`)
  AND none of the surnames are produced by the would-be `pickZipf(lastNames,
1.0)` formula on the same PRNG state (i.e. the unique-loop genuinely
  bypasses the configured `s = 1.0`).

### B55-R7: Documentation updates

The implementation commit **MUST** update the following pages in the same commit
per the doc rule in [`wiki/architecture.md`](../architecture.md) (D5):

- [`docs/api-reference.md`](../../docs/api-reference.md) — document the new
  `Prng.pickZipf<T>(items, s): T` overload and the two new `LocaleData` fields.
- [`docs/concepts.md`](../../docs/concepts.md) — explain the Zipf-default
  rationale, note the deliberate divergence from faker's uniform draws (see B51
  report §6), describe the `frequencyExponent: 0` opt-out for faker-style
  behaviour, and document the unique-context auto-flatten (R6).

Reviewer-only requirement: verified by `Read` on the diff, not by a test.

- Scenario: api-reference covers `pickZipf` and `LocaleData` additions
  GIVEN the post-commit `docs/api-reference.md`
  WHEN it is read at review time
  THEN it contains a `pickZipf` signature description on the `Prng` interface
  section AND a description of `frequencyExponent` /
  `frequencyExponentOverrides` on the `LocaleData` section.

- Scenario: concepts covers Zipf rationale + unique auto-flatten
  GIVEN the post-commit `docs/concepts.md`
  WHEN it is read at review time
  THEN it contains a section explaining Zipf-default sampling and an explicit
  note that unique contexts auto-flatten to uniform.

### B55-R8: Changeset entry

The implementation commit **MUST** include a changeset at
`.changeset/b55-zipf-distributed-pick.md` with a `minor` bump for
`zod4-mock`, `@zod4-mock/locale-core`, `@zod4-mock/locale-en`, and
`@zod4-mock/locale-nl` (per locked decision Q-8 and the B39 / B48 precedent).
Notes **MUST** call out the seed → value-mapping shift on open-corpus fields
and the integration-snapshot re-pin applied in the same commit.

Reviewer-only requirement: verified by reading the `.changeset/` directory.

- Scenario: changeset names all four packages with `minor` bumps
  GIVEN the post-commit `.changeset/b55-zipf-distributed-pick.md`
  WHEN it is read at review time
  THEN the frontmatter contains a `minor` bump entry for each of the four
  packages listed above.

### B55-R9: Integration-snapshot re-pin in the same commit

Integration-test fixtures in
[`tests/integration/`](../../tests/integration/) that capture specific generated
values from open-corpus fields **MUST** be re-pinned in the same commit as
R1–R8. The diff **MUST** be limited to value shifts produced by the new
Zipf-default behaviour on open-corpus fields (and the freq-sort retrofit on
first names); no incidental, unrelated snapshot shifts are permitted.

Reviewer-only requirement: verified by inspecting the snapshot diff and
confirming each shifted value corresponds to an open-corpus field per the R3
classification.

- Scenario: snapshot diff is bounded to open-corpus shifts
  GIVEN the post-commit integration snapshot diff
  WHEN the reviewer reads it
  THEN every changed line corresponds to a field that was open-corpus per the
  B51 §1 inventory (e.g. `lastName`, `firstName`, `city` once expanded, etc.)
  AND no field that was closed-corpus per R3 (e.g. `state`, `month`,
  `weekday`) has changed.

### B55-R10: No new public-API surface beyond `Prng.pickZipf`

The implementation **MUST NOT** introduce any new public API on `World`,
`Registry`, the matcher context (`GeneratorContext`), or any other shipped
surface beyond `Prng.pickZipf` (R1) and the two `LocaleData` field additions
(R2). Matcher authors that want Zipf weighting on their own arrays do so via
`ctx.prng.pickZipf(arr, s)`.

- Scenario: no new exports on `src/index.ts`
  GIVEN the post-commit `src/index.ts`
  WHEN its exported symbols are compared against the pre-commit baseline
  THEN no new exports appear other than ones routed by the `Prng` interface
  re-export and the `LocaleData` re-export (which are not direct new exports
  — `Prng` and `LocaleData` are already exported).

### B55-R11: No new standing constraint promoted

The mechanism falls under existing rules
[D4 / D10](../decisions.md) (closed-form inverse-CDF, one `prng.random()` draw,
per-field PRNG fork preserved) and
[D13](../decisions.md) (isomorphism — `Math.pow` / `Math.floor` / `Math.max`
only, no `node:*`, no `Buffer`). The implementation **MUST NOT** propose a new
`D<n>` candidate for the Zipf-default direction; the per-corpus-distribution
mapping is a data-layer choice belonging to per-locale `extend()`, not an
architectural constraint future work must obey across all packages
([B51 report §9](../research/text-generation/locale-list-size-targets.md#9-no-new-standing-constraint)).

Reviewer-only requirement: verified by reading `wiki/decisions.md` and
confirming no new ADR landed in this commit.

- Scenario: no new D-number lands
  GIVEN the post-commit `wiki/decisions.md`
  WHEN compared against the pre-commit version
  THEN no new D-section has been appended.

## Minimum tests directive

Per [[feedback-minimal-tests]], **one test file** —
`tests/unit/B55-zipf-distributed-pick.test.ts` — with approximately six
`it(...)` blocks, one per **test-bearing** R-ID:

- **R1** — two `it(...)` blocks: (a) `s = 0` reproduces `pick` AND consumes one
  draw; (b) Zipf-1 head-skew on a 10-element array, 1000 samples.
- **R2** — type-level field presence on a representative locale object (no
  runtime behaviour beyond the override-precedence read).
- **R3** — one open-corpus call-site assertion (representative: `lastNames`)
  routing through `pickZipf`, and one closed-corpus call-site assertion
  (representative: `states`) staying on `prng.pick`.
- **R5** — first-three-entries assertion against the shipped
  `firstNamesMale` (descending-frequency post-retrofit) and `lastNames`
  (unchanged regression guard).
- **R6** — unique-loop flattens to `s = 0` on a Zipf-1-overridden
  `lastNames` corpus.

R4 is reviewer-eyeball (the R3 assertion exercises the resolution path
end-to-end; per-locale map values are structural). R7 (docs), R8 (changeset),
R9 (snapshot re-pin), R10 (no new exports), R11 (no new D-number) are
reviewer-only.

No Cartesian enumeration: the spec deliberately does **not** require a test
per open corpus or per locale. R3 picks one representative open corpus and one
representative closed corpus; R5 verifies the two first-name retrofits via the
shipped data files; R6 picks one corpus to demonstrate the auto-flatten
invariant.

## Standing-constraint analysis

Per [B51 report §9](../research/text-generation/locale-list-size-targets.md#9-no-new-standing-constraint):

- **D4 / D10** — the closed-form inverse-CDF in R1 preserves determinism: one
  `prng.random()` draw per `pickZipf` call, no rejection loop, deterministic
  per `(seed, items.length, s)`. The per-field PRNG fork on which `pickZipf`
  is invoked is unchanged.
- **D13** — `Math.pow` / `Math.floor` / `Math.max` are pure-JS ECMAScript;
  no `node:*` import, no `Buffer`, no `fs`/`zlib`/`process`. Runs unmodified
  in browsers, MSW, service workers, edge.
- **D15** — `LocaleData` remains the sole library↔locale boundary. The new
  `frequencyExponent` / `frequencyExponentOverrides` fields are typed in
  `@zod4-mock/locale-core` and read by the library through the `LocaleData`
  shape only. No new boundary; no library import from any locale package.

**Verdict: no new D-number candidate.** The reviewer confirms by ensuring no
new ADR has been appended to `wiki/decisions.md`.

## Composition note

- **Predecessor — B51 report.** The B51 inventory (§1) is the authoritative
  open/closed classification used by R3; the §2.3 per-corpus `s` map is the
  source of R4's values; the §3 freq-sort audit is the source of R5's
  retrofit list; the §7.1 unique-context analysis is the source of R6; the
  `prng.pick` uniformity confirmation in §5 grounds R1's `s = 0` equivalence
  claim.
- **Sibling — [B54](B54-realistic-numeric-distributions.md).** Same realism
  framing (closed-form inverse-CDF per field) applied to numeric fields. Both
  extend the `Prng` interface with a new method (`pickZipf` here,
  Benford/log-uniform helpers there). Independent dispatch; no shared code
  path beyond `Prng`.
- **Sibling — [B58-A](B58-A-english-inflection.md).** `formatSentence` owns its
  own internal picking; it does not collide with `frequencyExponent`. A
  locale's `formatSentence` may choose to call `prng.pickZipf` for its lemma
  picks but is not required to (the corpus-level config does not propagate
  into the callback).
- **D15.** The library reads locale fields via `LocaleData` only. Per-locale
  `s` values flow through the new `frequencyExponent*` fields; no locale
  package is imported by `src/`.

## Out of scope

- **Light-open-list expansions** (cities, jobTitles, departments, color names,
  productAdjectives, finance descriptions, company buzz / catchPhrase lists) —
  that's Card B
  ([B56](B56-locale-light-list-expansions.md) if filed; B55 ships the
  **mechanism**, B56 ships the **data expansions**).
- **nl `lastNames` 854 → larger refetch** — that's
  [B49](../backlog/inbox/B49-dutch-surname-refetch-meertens.md).
- **en `lastNames` 10K → 3–5K trim** —
  [B51 Q-3](../research/text-generation/locale-list-size-targets.md#82-non-blocking-recommendations-baked-in)
  deferred to a follow-up chore. Under Zipf-0.7 the tail past ~2K is rarely
  sampled, but pre-v1 is not the right moment to lose the 10K-Census-realism
  story B48 just shipped.
- **`word.nouns` / `word.adjectives` re-sourcing** from frequency-rated corpora
  (SUBTLEX-NC-SA is license-incompatible; Wiktionary frequency lists are the
  next investigation) — deferred to a separate research item. Under R4 these
  corpora ship with `s = 0` (uniform), matching today's behaviour.
- **`countries` / `countryCodes` to ISO 3166, `timeZones` to ~30** — Card B
  ([B56](B56-locale-light-list-expansions.md)) bakes these in as additive
  expansions.
- **No new public-API surface beyond `Prng.pickZipf`** (per R10). Matchers
  use `ctx.prng.pickZipf(arr, s)`.

## Open questions

None blocking. B51 Q-1 and Q-2 are locked from the review checkpoint
(2026-06-01); B51 Q-3 through Q-12 are either folded into the requirements
above (Q-8 → R8, Q-9 → R6, Q-10 → R7, Q-11 → R2 default-at-call-site, Q-12
→ R1) or explicitly deferred to follow-up items (Q-3, Q-4, Q-5, Q-6, Q-7)
under **Out of scope**.

No non-blocking spec-writer questions surface that would change what is
built. If R6's mechanism-agnostic phrasing leaves the test-writer guessing
about the unique-loop boundary, the observable invariant (every `pickZipf`
inside a `world.get` unique-loop behaves as `s = 0`) is asserted in the R6
scenario — the implementer picks the wiring.
