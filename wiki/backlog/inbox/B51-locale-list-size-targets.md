---
id: B51
title: Locale corpora — size targets (all fields) + Zipf-distributed (frequency-weighted) picks
type: research
priority: medium
flags: [review]
created: 2026-06-01
report: wiki/research/text-generation/locale-list-size-targets.md
---

## Description

Two related levers on locale-data quality, both decided here:

1. **Corpus size per field** — B50 established that list size (not encoding) is the
   dominant over-the-wire (OTW) cost. But it cuts both ways: the big-four corpora may be
   _too big_ (10K surnames ≈ 38–45 KB brotli), while **many smaller curated lists are
   too light** for realistic variety (`cities` = 35, `jobTitles` = 18). This item sets a
   **desired target size for every list field**, across all locales.
2. **Draw distribution** — change the default pick from uniform to **Zipf-weighted**
   (maintainer decision below) for the open, frequency-ranked corpora.

## Corpus inventory & size targets (the primary deliverable)

The research MUST inventory **every** `LocaleData` list field
([packages/locale-core/src/types.ts](../../../packages/locale-core/src/types.ts)) —
not just the big four — with its **current count per locale** and a **recommended
target**, and classify each as **open** (variety-bearing → expand toward a target,
Zipf-eligible) or **closed/enumerable** (bounded by reality → "complete" is the target,
stays uniform). Padding a closed set (e.g. inventing fake US states) is wrong; leaving an
open set tiny (35 cities) is the gap the maintainer flagged.

Known current sizes (sampled this session — research confirms + fills the rest):

| Domain   | Field(s)                                                          | Current (en / nl)             | Class    | Note                                               |
| -------- | ----------------------------------------------------------------- | ----------------------------- | -------- | -------------------------------------------------- |
| person   | firstNamesMale / Female                                           | ~3.4K / ~4.2K · ~4.2K / ~5.2K | open     | well-sized                                         |
| person   | **lastNames**                                                     | **10,000 / 854**              | open     | en likely _over_-sized; **nl light** (ties to B49) |
| person   | **jobTitles / jobAreas / jobTypes / jobDescriptors**              | 18 / 18 / 10 / 10             | open     | **light** — combinatorial, but base lists thin     |
| person   | prefixes, suffixes, genders                                       | 3–5                           | closed   | complete                                           |
| address  | **cities / streetNames / cityCores / cityPrefixes**               | cities **35**                 | open     | **light** — big variety gap                        |
| address  | states / countries / countryCodes / continents / directions       | states 50                     | closed   | enumerable; complete = target                      |
| commerce | **departments / materials / productAdjectives**                   | (inventory)                   | open     | **likely light**                                   |
| company  | **buzz\* / catchPhrase\*** (6 lists)                              | (inventory)                   | open     | **likely light**                                   |
| word     | nouns / adjectives                                                | 5K / 3K · 5K / 2K             | open     | well-sized                                         |
| word     | articles / prepositions / conjunctions / pronouns / interjections | 6 / 20 / 12 / 10 / 12         | closed   | complete by nature                                 |
| word     | **verbs / verbsPlural / adverbs**                                 | 32 / – / 16                   | open-ish | semi-light; expand modestly                        |
| finance  | **accountNames / transactionDescriptions**                        | (inventory)                   | open     | **likely light**                                   |
| finance  | currencies / bankCodes / bicLocations                             | (inventory)                   | closed   | real-world set                                     |
| date     | months / weekdays (+short)                                        | 12 / 7                        | closed   | complete                                           |
| color    | **names**                                                         | (inventory)                   | open     | **likely light** — colors are open-ended           |
| phone    | landlinePrefixes                                                  | (inventory)                   | closed   | real-world set                                     |

Targets to recommend (with OTW cost): e.g. open variety lists → a few hundred to low-
thousands where a real source exists; surnames → revisit the 10K (B46 §7.2 Q-B1; under a
Zipf draw the effective variety is far below N, so a smaller head costs little realism).
Each target needs a **sourcing note** (where do more cities / job titles / departments /
colors come from, and under what license — same bar as B46/B48).

## Direction: Zipf-distributed pick as the DEFAULT (maintainer decision, 2026-06-01)

Ship a Zipf (frequency-weighted) pick as the default for **open, frequency-ranked**
corpora; exponent tunable as a setting; `exponent = 0` recovers uniform. Closed/enumerable
sets stay uniform (no meaningful frequency ranking — don't make "January" rarer than
"March").

Rationale: name/word frequencies are heavy-tailed power laws; drawing proportionally
makes mock data look like production (repeated "John Smith"s) — good for testing dedup,
`GROUP BY`, "most-common" UIs. Pre-v1 is the moment to default to realism.

### Mechanism — inverse-transform sampling on a freq-sorted list (no shipped weights)

The sort order **is** the distribution. With `u = prng.random()`, exponent `s`, length `N`:

```
        ⎧  (N+1)^u                                  if s = 1   (classic Zipf)
  r(u) = ⎨  1 + u·N                                 if s = 0   (uniform — today's pick)
        ⎩  [1 + u·((N+1)^(1-s) − 1)]^(1/(1-s))       otherwise (general power law)

  index = clamp(floor(r) − 1, 0, N − 1)
```

Properties (all load-bearing): **one `prng.random()` draw** (D4/D10 unchanged — MUST be
closed-form inverse-CDF, never a rejection sampler); **zero extra payload** (reuses the
freq-sorted order); **isomorphic** (`Math.pow`/`Math.floor`, clean under D13); **plugs in
one layer deep** in the data generators, engine/pipeline unchanged (B46 §4).

### Setting shape (to validate)

Maintainer lean: ship the factor as a **locale setting** (`frequencyExponent`, default ~1).
But the exponent is more _corpus-type_-specific than locale-specific (words ≈1, surnames
≈0.6–0.7), so the recommended shape is a **locale default with optional per-corpus
overrides**. Research validates exponents against real frequency data.

## Questions to answer

1. **Full size inventory + targets (primary).** Current count + recommended target +
   open/closed class + sourcing note for **every** `LocaleData` list field, both locales.
   Explicitly call out the light open lists (cities, jobTitles, departments, color names,
   company buzz lists, finance descriptions, nl surnames).
2. **Default exponent per corpus.** Validate `s` against real frequency data (Census
   surnames, SSA first names, SUBTLEX words ≈1). Recommend per-corpus defaults + the
   single locale-level default. Closed sets → `s=0`.
3. **Freq-sort is load-bearing.** Ensure every Zipf-eligible corpus ships in descending
   frequency order. `last-names` is; verify SSA first names retain count order; dwyl
   `words_alpha` has **no** frequency signal → flag SUBTLEX or fall back to `s=0`.
4. **Compare with faker.** Sizes faker ships for the equivalent lists (names, cities,
   job titles, words, colors, departments) — are we over/under-shooting? faker draws
   uniform, so Zipf-default is a documented divergence. Read-only; no faker dep.
5. **Uniqueness / collision impact.** Smaller lists + Zipf-default both raise collisions
   for "generate N distinct entities" (interacts with B8 `unique` / `world.get`). Document
   `frequencyExponent: 0` opt-out + recommend whether `unique` contexts auto-flatten.

## Deliverable

`wiki/research/text-generation/locale-list-size-targets.md`: the full per-field inventory
table (current / target / class / sourcing) for both locales; recommended default
exponents validated against frequency data; the setting shape; a faker comparison; the
uniqueness trade-off + opt-out; and the concrete config + size/sourcing targets an
implementation card would apply. Spin Zipf-pick + corpus-expansion off as their own
`feature` card(s) once signed off.

## Notes

- **Do NOT modify any code.** Read-only analysis; writes only the research report.
- **Predecessors**: B50 (encoding null-result), B46 spike (§3 sizes, §7.2 Q-B1 surname
  sizing), B49 (nl surname sourcing — overlaps the nl `lastNames`=854 gap). `prng.pick`
  confirmed uniform at [src/prng.ts:91-93](../../../src/prng.ts) — `s=0` reproduces it.
- `flags: [review]` — Zipf-as-default is a pre-v1 behavior change, and corpus-expansion
  needs sourcing/licensing sign-off before implementation cards are filed.
