# B48: Replace Markov chains with real wordlists; drop `packages/locale-names/`; `LocaleData` cleanup

## Context

This item implements the direction approved at the B46 review checkpoint (sign-off
recorded 2026-05-31). The library currently generates names and open-class words
via character-level Markov chains, producing plausible-gibberish output
("Risharoumas", "Aar_Aade") that the runtime sampler in
[`src/generators/data/markov/sample.ts`](../../src/generators/data/markov/sample.ts)
props up with a 4-consonant-run rejection regex, up-to-8 retry attempts and an
`"x"` sentinel fallback ([`sample.ts:55-65`](../../src/generators/data/markov/sample.ts#L55)).
Per-call PRNG consumption is data-dependent (1 + N character draws + up to 7
rejection retries), which makes downstream determinism harder to reason about
even though D4 / D10 (per-(seed + schema identity + per-schema call index)) still
holds at the wrapper level. The trained models ship at **~2.86 MB** total
(`packages/locale-names/` 2.34 MB + locale-en's name + word models ~530 KB) per
[B46 spike §3.1](../research/text-generation/wordlist-sourcing-spike.md).

B45 ([research/text-generation/markov-alternatives.md](../research/text-generation/markov-alternatives.md))
established the direction (real wordlists sampled by `prng.pick`); B46 ([sourcing
spike](../research/text-generation/wordlist-sourcing-spike.md)) measured the
trade-off. Headline measurements anchor every claim below:

- **13.5×** reduction across the 5 locale-names origin groups — 2.34 MB Markov
  models → **172 KB** front-coded + brotli total
  ([B46 §3.1 measured](../research/text-generation/wordlist-sourcing-spike.md#31-measured--packageslocale-namesdatatraining-real-corpora)
  via `scripts/b46-measure-corpus-sizes.ts`).
- **10×** reduction on EN words alone — ~201 KB Markov noun+adjective models →
  **~20 KB** lemma lists + the existing 5-template PCFG ([B46 §5.1](../research/text-generation/wordlist-sourcing-spike.md#51-real-lemma-lists-alone)).
- **~85 KB** total locale-en bundle after filtering US Census surnames to top
  10,000 ([B46 §3.3](../research/text-generation/wordlist-sourcing-spike.md#33-estimated--packageslocale-en-raw-corpora-fetched-on-demand);
  unfiltered ~315 KB).
- Per-call PRNG consumption: **variable → constant** (one `prng.pick` draw per
  call). The existing per-schema slot machinery (D10, B39) is untouched —
  determinism becomes strictly more legible without changing the
  `(seed + schema identity + slot)` invariant the spec architecture rests on.

The existing `simple*` fallback arrays on
[`packages/locale-core/src/types.ts:62-65`](../../packages/locale-core/src/types.ts#L62)
already plumb `readonly string[]` end-to-end through
[`src/generators/data/word.ts:75,87`](../../src/generators/data/word.ts#L75) and
[`src/generators/data/person.ts:58-66,76,77,85`](../../src/generators/data/person.ts#L58)
(see [B46 §4.2](../research/text-generation/wordlist-sourcing-spike.md#42-the-fallback-is-already-a-string)).
The shape change collapses to: drop the Markov branches, rename the `simple*`
fields to the canonical names (the prefix existed only because the Markov path
was primary), and populate them from compressed blobs decompressed at load time
inside each locale package.

This change touches five workspaces (root, `locale-core`, `locale-en`,
`locale-nl`, and deletes `locale-names`) and closes GitHub issue **#24** (B42 —
the Dutch initial-letter A/B/C/D skew). The skew is closed by construction under
`prng.pick(realList)` ([B46 §6](../research/text-generation/wordlist-sourcing-spike.md#6-b42-issue-24-empirical-confirmation)):
the Dutch male/female/last-name corpora have measured A+B+C+D mass of 22.0% /
23.1% / 21.8% (B46 §3.1 table) — within the natural language band and nowhere
near the 80%+ B42 user-observed.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined
> in RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B48-R1: Delete `packages/locale-names/` from the workspace

The system MUST NOT contain `packages/locale-names/` after this item lands, and
neither `pnpm-workspace.yaml` nor the root `package.json` MUST reference the
package.

**Verification**: reviewer-only (diff inspection — `git diff` shows the deletion;
no runtime behaviour change to assert). Existing test suite must stay green
(no imports from `@zod4-mock/locale-names` may remain).

### B48-R2: Delete the Markov runtime code path from `src/`

The system MUST NOT contain `src/generators/data/markov/` (the directory or any
file in it), and the symbols `sampleMarkov`, `sampleWeighted`, the `CONSONANT_RUN`
rejection regex, the up-to-8 retry loop, and the `"x"` sentinel return MUST NOT
appear anywhere under `src/` after this item lands. The training scripts
`scripts/train-markov.ts` and `scripts/verify-markov.ts` MUST NOT exist.

**Verification**: reviewer-only (diff inspection — the deletions are visible in
`git diff`; any leftover `sampleMarkov` import or reference would surface as a
typecheck error and break `pnpm validate`).

### B48-R3: Canonicalise `LocaleData` shape — drop Markov fields, drop the `simple` prefix

The `LocaleData` type in
[`packages/locale-core/src/types.ts`](../../packages/locale-core/src/types.ts)
MUST be reshaped as follows in a single change:

- `person.firstNamesMale`, `person.firstNamesFemale`, `person.lastNames`
  MUST be retyped from `readonly NameOriginSet[]` to `readonly string[]`
  (they take over the slot today's `simpleFirstNamesMale` / `simpleFirstNamesFemale`
  / `simpleLastNames` occupies).
- `person.simpleFirstNamesMale`, `person.simpleFirstNamesFemale`,
  `person.simpleLastNames` MUST be removed (their content moves to the renamed
  fields above).
- `word.nounModel`, `word.adjectiveModel` MUST be removed; `word.nouns` and
  `word.adjectives` keep their existing `readonly string[]` shape and become the
  canonical fields (no Markov-flavoured alternative).
- The types `MarkovModel` and `NameOriginSet` MUST be removed from the
  `@zod4-mock/locale-core` public exports.
- `LastNamePrefix` and all non-Markov sections (`address`, `commerce`, `company`,
  `finance`, `date`, `color`, `phone`) MUST stay shape-compatible with today's
  definitions.
- The `extend()` shallow-per-section merge in
  [`packages/locale-core/src/extend.ts`](../../packages/locale-core/src/extend.ts)
  MUST continue to compile against the new `LocaleData` and produce a valid
  `LocaleData` when overriding any subset of the new fields (no signature
  change required — the file only references section keys, not the removed
  field names).

**Verification**: TypeScript itself + reviewer (the type-shape change is
enforced by `pnpm typecheck` — any caller still reading `simpleFirstNamesMale`
or `nounModel` becomes a typecheck error; the existing test suite calls
`extend()` and exercises every consuming generator, so any breakage surfaces
without a B48-specific test).

### B48-R4: `locale-en` ships a compressed-blob data layer that stays under 100 KB

`@zod4-mock/locale-en` MUST ship its name data and word data as compressed
blob(s) decompressed to `readonly string[]` at module load, and the total
on-disk weight of the locale-en distribution data (its blob(s) plus any
generated `.ts` constants those blobs decompress into) MUST be **≤ 100 KB**
(target: ~85 KB per [B46 §3.3](../research/text-generation/wordlist-sourcing-spike.md#33-estimated--packageslocale-en-raw-corpora-fetched-on-demand)).

The bundle-size test mechanism is a Node test (`tests/unit/locale-en-bundle.test.ts`
or sibling): the test enumerates the committed blob file(s) under
`packages/locale-en/data/blobs/` (or whichever directory the implementer chose
— see Open question O-1 below) plus any locale-en source files larger than
1 KB that exist solely to ship Markov-replacement string data, sums
`fs.statSync(p).size` over them, and asserts the total is `≤ 102_400`. Pure
code files (locale.ts, format functions, etc.) are excluded; the test SHOULD
target only the data layer.

**Verification**: reviewer-only. The reviewer sums the data-layer byte size by
hand (`ls -l` / `du -sh` on the blob directory, in their head — the diff makes
this trivial). A runtime test would just be regex-checking the implementer's
file layout. If the implementer reports the sum in the dispatch summary, the
reviewer cross-checks against the diff.

### B48-R5: `locale-nl` ships Dutch first names migrated from `locale-names`, plus refetched surnames (amended per B49 — 2026-06-01)

`@zod4-mock/locale-nl` MUST populate `person.firstNamesMale`,
`person.firstNamesFemale` and `person.lastNames` from real wordlists shipped
inside the locale-nl package (not imported from the deleted `locale-names`).
The Dutch surname source MUST trace to a CBS-authoritative publication (the 2007 `Familienamen Top-1000` is the canonical baseline; CC-BY-4.0 per the CBS Open Data Portal explicit license at `opendata.cbs.nl/portal.html` — verified 2026-06-02 under B59 Q-2). Refetching from a bulk CBS / Meertens endpoint remains the long-term aspiration but is **NOT** required because no such endpoint exists today. The
digitalheir/family-names-in-the-netherlands mirror flagged at [B46 Q-S2](../research/text-generation/wordlist-sourcing-spike.md#71-corpora--licenses)
as license-undeclared MUST NOT be the shipped source. The Dutch first-name
source is `open-nl-data/dutch-names-dataset` (MIT) per [B46 Q-S1](../research/text-generation/wordlist-sourcing-spike.md#71-corpora--licenses).
The fetch / build script that produces locale-nl's blob(s) MUST be checked in
under `packages/locale-nl/scripts/fetch-data.ts` and MUST document the source
URL and license at the top of the file (matching the style of
[`packages/locale-en/scripts/fetch-data.ts`](../../packages/locale-en/scripts/fetch-data.ts) lines 1-11).

**Verification**: reviewer-only. The license + source URL appears in the
`fetch-data.ts` header comment (visible in the diff). The existing test suite
already exercises Dutch name generation via `@zod4-mock/locale-nl`, so any
broken import or empty list surfaces as a real-name regression in those tests.

### B48-R6: `locale-en` surnames are filtered to top-10K by frequency from US Census 2010

`packages/locale-en/scripts/fetch-data.ts` MUST be updated so the US Census
2010 surname pipeline filters the input list to the top 10,000 most-common
surnames (by the published `count` column on the Census CSV), in descending
frequency order, and writes that list as the input to the compressed-blob
encoder. The current behaviour (line 68-74) takes all ~150,000 entries that
pass the `/^[a-z]+$/` regex; this MUST be replaced with a top-N-by-frequency
filter where N = 10,000.

**Verification**: reviewer-only. The filter is a single line in
`fetch-data.ts` (`.slice(0, 10_000)` after a frequency sort) — visible in the
diff. The implementer reports the filter line in the dispatch summary; the
reviewer cross-checks.

### B48-R7: Per-call PRNG consumption from the replacement code path is exactly one draw

Every replacement call site for `sampleMarkov` / `sampleWeighted` — concretely
the `noun()`, `adjective()`, `firstName()` (single-gender path), and
`lastName()` functions in `src/generators/data/word.ts` and
`src/generators/data/person.ts` — MUST consume exactly one call to the
underlying PRNG's `random()` method per invocation, by virtue of dispatching
to a single `prng.pick(list)` (which is one `Math.floor(prng.random() * n)`
per `src/prng.ts:91-93`). The mixed-gender path of `firstName()` (gender
unspecified) MAY consume two draws — one for the gender coin-flip, one for the
pick — because that's a structurally distinct decision.

The test mechanism is a `Prng`-wrapping counter: the test wraps a real
`Prng` instance in a thin proxy that increments a counter on each `random()`
call, hands the proxy to each of `noun(prng, ctx)`, `adjective(prng, ctx)`,
`firstName(prng, "male")`, `firstName(prng, "female")`, `lastName(prng, ctx)`,
resets the counter before each, and asserts the counter equals 1 immediately
after each call. The locale under test is `nl` (or `en`) post-B48, so the
real wordlists are populated.

**Verification**: TEST (the only test-bearing R in B48). Test file
`tests/unit/B48-prng-counter.test.ts`. Wraps a `Prng` in a counting proxy, calls
each leaf generator once, asserts counter is 1 after each. This is the only
new runtime invariant B48 establishes — worth pinning so a future regression
that adds an extra `prng.random()` to a leaf generator surfaces immediately.

- Scenario: each replacement call consumes exactly one PRNG draw
  GIVEN a counter-wrapping `Prng` proxy and the post-B48 `nl` locale
  WHEN any of `noun(prng, { locale: nl })`, `adjective(prng, { locale: nl })`,
  `firstName(prng, "male", { locale: nl })` _(passing locale via ctx if the
  signature requires it)_, `firstName(prng, "female", ...)`, or
  `lastName(prng, { locale: nl })` is invoked
  THEN the proxy's `random()` call count incremented by exactly 1.

### B48-R8: `sentence()` keeps the 5-template PCFG, only leaf generators change

The `sentence()` function at
[`src/generators/data/word.ts:126-156`](../../src/generators/data/word.ts#L126)
MUST retain its 5-template uniform-weight tuple, the existing `templates`
shape, the `prng.pick(templates)()` dispatch on line 150, and the
minimum-length expansion loop on lines 152-154. The only permitted change to
this function is the indirect one through the `noun()` / `adjective()` leaf
generators (already at lines 134-135), which switch from `sampleMarkov` to
`prng.pick(realList)` via R3's `LocaleData` reshape.

**Verification**: reviewer-only. Reading the diff is the check —
`sentence()` is either touched or it isn't. Existing tests for `sentence()` in
the suite would catch any structural break.

### B48-R9: `docs/api-reference.md` reflects the new `LocaleData` shape

`docs/api-reference.md` MUST be updated in the same item (per D5) such that:

- The `LocaleData` section (current lines 1061-1167) no longer mentions
  `NameOriginSet`, `MarkovModel`, `nounModel`, `adjectiveModel`,
  `simpleFirstNamesMale`, `simpleFirstNamesFemale`, or `simpleLastNames`.
- The "Markov vs. simple locales" paragraph (current lines 1169-1174) is
  removed or rewritten to describe the single canonical shape.
- The `MarkovModel` section (current lines 1180-1191) and the `NameOriginSet`
  row in the top-of-page type table (current line 39-40) are removed.

**Verification**: reviewer-only. The docs diff is visible; substring grep is a
reviewer eye-check, not a runtime test.

### B48-R10: Changesets land for every bumped workspace package

A changeset MUST be added under `.changeset/` describing the change. Bump type
is **`minor`** for every published workspace package whose surface changes
under B48: `zod4-mock` (root), `@zod4-mock/locale-core` (LocaleData shape
break), `@zod4-mock/locale-en` (data shape break), and `@zod4-mock/locale-nl`
(data shape break). Per the 0.x SemVer precedent established by B45 / B39, a
breaking change under 0.x ships as `minor`, not `major`. `@zod4-mock/locale-names`
is deleted from the workspace; the changeset SHOULD note its removal but does
not need its own bump entry (it has no further versions to publish).

**Verification**: reviewer-only. The changeset file is in the diff; the
changeset CLI / CI enforces well-formedness.

### B48-R11: ~~Dutch first-letter distribution test~~ — DROPPED

**Removed 2026-05-31 during test-writer dispatch** (user direction). The
A/B/C/D skew that motivated B42 / GitHub issue #24 was an artifact of:

- the Markov chain's training distribution,
- the rejection-sampling loop favouring start states that compounded the bias,
- the `"x"` sentinel fallback adding visible "x" tokens to the output.

All three failure modes are **gone by construction** when Markov is removed
(R2). Under `prng.pick(realList)` the first-letter distribution IS the natural
distribution of the source corpus — there's no code path that can produce the
A/B/C/D skew. Writing a regression test for a failure mode whose entire
mechanism has been deleted would be testing that water is wet.

B42 / #24 closes by removing the failure surface, not by asserting against it.
The reviewer signs off on the closure by confirming R1 / R2 / R3 land cleanly.
The B46 spike's §6 confirmation (Markov empty-state mass = real-list natural
mass) is the analytical proof; B48 inherits that proof rather than re-running
it as a runtime test.

## Out of scope

- **Syllable-n-gram pseudo-words** (B45 option 3). Users wanting invented-but-plausible
  filler can use `prng.alphanumeric` or extend a locale with custom generators.
  Filed only if user demand arises.
- **Weighted PCFG sentence rules** (B46 §5.2). The existing 5-template
  uniform-weight machinery stays; corpus-frequency weighting is a separate
  refinement item.
- **Native-source arabic / frisian / turkish / south-asian locales**. The
  current regex-classified slices are dropped under B48 with the rest of
  `locale-names`; restoring those locales with proper native-language sources
  is one separate `feature` item per locale.
- **`extend()` API improvements**. The existing shallow-per-section merge
  keeps working unchanged; UX improvements are out of scope.
- **Snapshot re-pinning for downstream consumers**. The seed→value mapping
  shifts (a value previously "Risharoumas" becomes a real name); this is
  accepted under 0.x SemVer per B45 Resolution / B39 precedent. The in-repo
  test suite is structural and matcher-derived; the test-writer + reviewer
  audit during this item.
- **`scripts/train-markov.ts` retention as opt-in dev tooling** (B46 O-A3).
  The card pins deletion; if a future user wants invented words, a fresh
  dev-tooling item can be filed.

## Open questions

### Non-blocking — implementer's call

- **O-1 — Blob storage location** _(non-blocking)_. The exact filesystem
  location of the committed compressed blob(s) (`packages/locale-en/data/blobs/`,
  `packages/locale-en/data/compressed/`, or co-located with the source) is the
  implementer's choice. The R4 test mechanism enumerates whichever directory
  is chosen, so the spec's contract is portable; reviewer signs off on the
  layout at review.
- **O-2 — Bundle blob format: front-coded + brotli vs. plain brotli vs.
  separate per-section blobs** _(non-blocking)_. Per [B46 §3.3](../research/text-generation/wordlist-sourcing-spike.md#33-estimated--packageslocale-en-raw-corpora-fetched-on-demand)
  the ~30% size delta between brotli-only and front-coded+brotli does not
  threaten R4's 100 KB ceiling — either passes with margin. Implementer
  chooses; review the format choice + rationale at PR.
- **O-3 — Eager vs. lazy decompression** _(non-blocking)_. Decompression at
  module import (eager, ~tens of ms once) vs. on first use (lazy with a sync
  boundary). [B46 O-A2](../research/text-generation/wordlist-sourcing-spike.md#8-open-questions-surfaced-by-the-spike)
  recommends eager-sync to match today's locale model load; implementer
  picks one and documents it in a comment at the load site.
- **O-4 — `locale-en` `nouns.txt` / `adjectives.txt` heuristic vs. curated
  source** _(non-blocking — deferred by user)_. The current
  `packages/locale-en/scripts/fetch-data.ts:95-110` adjective filter is a
  suffix heuristic over `dwyl/english-words`. [B46 Q-S8](../research/text-generation/wordlist-sourcing-spike.md#71-corpora--licenses)
  flagged this for a curated POS source (OANC, SUBTLEX-US, WordNet) but
  user sign-off deferred it. The heuristic stays under B48; replacement
  is a separate item.

### Resolved at B46 sign-off (recorded for traceability)

All B46 §7 blocking maintainer questions (Q-S1, Q-S2, Q-S3, Q-S6, Q-S7, O-A1,
O-A5, Q-B1) were answered at the B46 review checkpoint #2 (2026-05-31) and
their resolutions are folded into the requirements above:

- Q-S1 → R5 (open-nl-data/dutch-names-dataset MIT shipping accepted).
- Q-S2 → R5 (refetch from CBS / Meertens, drop digitalheir mirror).
- Q-S3 → R6 (refetch from US Census 2010 directly, filter to top-10K).
- Q-S6 + Q-S7 → "Out of scope" (regex-classified arabic/frisian/turkish/south-asian
  dropped along with `locale-names`).
- O-A1 + O-A5 → R3 (cross-package LocaleData reshape, all consumers updated
  in this item).
- Q-B1 → R6 (top-10K, hits R4's ~85 KB target).

No blocking question remains. The item proceeds to test-writer.

## Standing constraint candidate

**Candidate rule**: _Locale data layers in `@zod4-mock/locale-_`packages
SHOULD ship name + word corpora as real wordlists sampled by`prng.pick`,
not as character-level Markov chains.\*

This is borderline standing-constraint material. Arguments for promoting:
B48 explicitly forecloses the Markov approach across the family, and a future
"add `locale-fr`" item should not reintroduce it. Arguments against: it's
sufficiently captured by the `LocaleData` type signature post-R3 — there is
no longer a Markov field a future locale could populate without first reverting
locale-core. **Recommendation: do not promote a new rule.** The type signature
is the enforcement; B48's appearance in `decisions.md` (the manager's call on
promotion) is enough rationale.

If the manager elects to promote, the ADR rationale that belongs in
`decisions.md` is: _"Locale packages ship real wordlists, not character-level
Markov models. Decision driven by 13.5× bundle reduction (B46 §3.1), 10×
reduction on word data (B46 §5.1), per-call PRNG becoming constant (B46 §4.3),
and B42 closure by construction (B46 §6.3)."_

## Minimum tests directive

**One test file. One R-ID under test (R7). ~4-5 `it(...)` blocks.** Everything else is
reviewer + typecheck + existing-suite coverage.

Per [[feedback-tests-test-behavior]] and the user's 2026-05-31 direction, the
test-writer writes runtime behaviour tests only — not artifact-checks. The
behaviour-bearing requirement in B48 is **R7** (constant PRNG draws); everything
else is one of:

- **typecheck-enforced** (R3): if `LocaleData` reshape breaks, `pnpm typecheck`
  fails. No runtime test needed.
- **reviewer-eyeball** (R1, R2, R4, R5, R6, R9, R10): file deletions, type
  renames, docs purges, changeset frontmatter, blob-size sums — all visible in
  the diff. The reviewer signs off; tests don't.
- **existing-suite coverage** (R8, plus implicit name/word output regressions):
  `sentence()` already has callers in the suite; the leaf swap can't change
  the output type without those tests failing.
- **structurally impossible** (R11, dropped): once Markov is gone, the failure
  mode the test would assert against can't occur.

The single new test file: `tests/unit/B48-prng-counter.test.ts` with `it(...)`
blocks for each of the 5 leaf generators (`noun`, `adjective`, `firstName("male")`,
`firstName("female")`, `lastName`). The PASS-as-guard alternative — the
unspecified-gender `firstName()` call — uses 2 draws (gender coin-flip + pick),
which is its own explicit `it(...)` so the contract is documented.

Total: **1 test file, ~5 `it(...)` blocks**. RED today (Markov burns N+ draws);
GREEN after the implementer swaps to `prng.pick`. Suite count goes 1044 → ~1049.

## Notes

- **Anchor reading**:
  - [B46 spike report](../research/text-generation/wordlist-sourcing-spike.md) (sourcing + sizing)
  - [B45 research](../research/text-generation/markov-alternatives.md) (parent direction)
  - [`packages/locale-core/src/types.ts:51-180`](../../packages/locale-core/src/types.ts#L51) (current `LocaleData`)
  - [`packages/locale-core/src/extend.ts`](../../packages/locale-core/src/extend.ts) (must keep compiling)
  - [`src/generators/data/word.ts:73-90,126-156`](../../src/generators/data/word.ts#L73) (Markov call sites + PCFG)
  - [`src/generators/data/person.ts:58-100`](../../src/generators/data/person.ts#L58) (name helpers)
  - [`src/generators/data/markov/sample.ts`](../../src/generators/data/markov/sample.ts) (to be deleted)
  - [`packages/locale-en/scripts/fetch-data.ts`](../../packages/locale-en/scripts/fetch-data.ts) (needs surname filter + blob encode)
  - [`packages/locale-en/src/locale.ts`](../../packages/locale-en/src/locale.ts) (must stop importing `@zod4-mock/locale-names`)
  - [`packages/locale-nl/src/locale.ts`](../../packages/locale-nl/src/locale.ts) (must stop importing `@zod4-mock/locale-names`)
  - [`src/prng.ts:80-130`](../../src/prng.ts#L80) (one-draw budget reference for R7)
- **B42 closure**: B42's GitHub issue (#24) is closed-by-construction under R11.
  The manager moves `wiki/backlog/inbox/B42-…md` (or `wiki/backlog/done/B42-…md`
  if already filed cancelled per the card's note) to `done/` with
  `flags: [cancelled]` no later than this item's landing commit. The commit
  subject includes `(closes #24)` per the per-item commit convention.
- **Bump shape**: `minor` for `zod4-mock`, `@zod4-mock/locale-core`,
  `@zod4-mock/locale-en`, `@zod4-mock/locale-nl` (see R10). NOT major: 0.x
  precedent (B39, B45) ships breaking changes as minor.
- **Changeset wording sketch**:
  > Replace character-level Markov chains with real wordlists sampled by
  > `prng.pick`. The `LocaleData` shape collapses to `string[]` name and
  > word fields (the `simple` prefix is dropped; `nounModel`, `adjectiveModel`,
  > `NameOriginSet`, and `MarkovModel` are removed). `@zod4-mock/locale-names`
  > is removed from the workspace; Dutch first names move into
  > `@zod4-mock/locale-nl`; Dutch surnames are refetched from CBS / Meertens;
  > English surnames are filtered to the top 10,000 by US Census 2010
  > frequency. Closes #24 (B42, Dutch initial-letter A/B/C/D skew).
  > Per-call PRNG consumption from name and open-class-word generators
  > becomes constant (one draw per call) — strictly stronger determinism
  > under D4 / D10.
- **GitHub issue**: closes **#24** (B42).
- **D5 trigger**: `docs/api-reference.md` is updated as part of this item per
  R9 — sections at lines 38-40 (top-of-page type table), 1012, 1061-1167
  (`LocaleData`), 1169-1174 ("Markov vs. simple locales" paragraph), and
  1180-1191 (`MarkovModel`).
- **D6 trigger**: B48 inherits B42 as the underlying bug; R11 is its regression
  test.
- **D4 / D10**: untouched. The per-schema slot machinery (B39) continues to
  govern fork keys; R7 codifies that the constant-PRNG improvement strengthens,
  not changes, the rule.
- **D11**: untouched. `PIPELINE` / `PIPELINE_NO_REGISTRATION` are not modified;
  this change lives below the pipeline in the data-generator layer.
- **D12**: not exercised by this item.
- **B48 id reuse note**: this id was previously consumed by a one-line
  fmt-sweep ticket filed in error and cancelled inline (commit `b7630d3`).
  The card slot is empty at HEAD; this is the real B48.
