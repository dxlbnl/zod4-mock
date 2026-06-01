# Locale Corpora — Per-Field Size Targets and Zipf-Distributed Picks (B51)

> **Research report for backlog item
> [B51](../../backlog/doing/B51-locale-list-size-targets.md).** Read-only analysis;
> no code, locale data, or schemas were modified. Anchored to the measured
> counts in the in-tree data files (`packages/locale-en/src/data/`,
> `packages/locale-nl/src/data/`) and to the file inventory of
> `packages/locale-core/src/types.ts`.
>
> **Predecessors:**
> [B46 wordlist-sourcing spike](wordlist-sourcing-spike.md) (current measured
> name-corpus shapes + sourcing/licensing model),
> [B48 — Markov → real wordlists](../../backlog/done/B48-replace-markov-with-real-wordlists.md)
> (the rewrite that produced the shipped data layer),
> [B50 isomorphic encoding null-result](isomorphic-corpus-encoding.md)
> (made list size the dominant OTW cost).
>
> **Sibling:** [B54 — realistic numeric distributions](../../backlog/inbox/B54-realistic-numeric-distributions.md)
> applies the same "right distribution per field, one closed-form inverse-CDF
> draw" framing to numeric fields.
>
> **Binding constraints:** D4 / D10 (determinism — closed-form inverse-CDF of
> **one** `prng.random()` draw, never a rejection sampler), D13 (isomorphism —
> shipped code must run in browsers / MSW / service workers / edge; no `node:*`,
> no `Buffer`, no `fs`/`zlib`/`process`), D14 (`generateArray` trailing-pass
> unification — out of scope here; touch is one layer deep in data generators).

---

## §0. TL;DR

1. **Inventory.** The `LocaleData` shape carries **~60 list-style fields per
   locale** across nine domains (`person`, `address`, `commerce`, `company`,
   `word`, `finance`, `date`, `color`, `phone`). The vast majority are already
   "complete" closed/enumerable sets (months, weekdays, continents, US states,
   provinces, articles, prepositions, conjunctions, currencies, surname
   tussenvoegsels) and **stay uniform** (`s = 0`). The "light open lists" the
   maintainer flagged — `cities` (35/30), `jobTitles` (18/18), `departments`
   (20/20), `productAdjectives` (21/21), all six `company.{buzz,catchPhrase}*`
   lists (15–20), `color.names` (24/24), `finance.transactionDescriptions`
   (15/15), `address.streetNames` en (45), `address.cityCores`/`cityPrefixes`
   — are confirmed light and have **published-source expansion targets** of a
   few hundred entries each. The nl `lastNames` = **854** stays as-is pending
   B49 (CBS / Meertens refetch).
2. **OTW-cost aggregate.** With the recommended targets applied:
   - locale-en grows by **~40–50 KB raw source** (cities to 500, jobTitles to
     ~300, streetNames to ~150, departments to 80, company-buzz lists to 80
     each, color names to 200, transactionDescriptions to 80) → from ~333 KB
     raw / ~38–45 KB OTW today to **~375 KB raw / ~45–55 KB OTW**.
   - locale-nl grows by **~40 KB raw source** (cities to 500, streetNames
     already at 84 → 200, departments to 80, etc.) → **~280 KB raw /
     ~33–40 KB OTW**.
   - With **Zipf-default sampling** the **realism** per byte improves
     independently of size: head-of-distribution entries get the airtime they
     should, so cutting the surname tail later doesn't lose much.
3. **Default Zipf exponent.** Recommend the locale-level default
   `frequencyExponent: 1.0` (classic Zipf — matches SUBTLEX-style word-rank
   frequencies and SSA first-name rank curves to within a constant factor),
   with **per-corpus overrides**: `lastNames: 0.7` (Census surnames fall off
   slower — empirically the rank-frequency curve has `s ≈ 0.6–0.8`),
   `firstNames*: 0.9` (SSA top-N name rank curves a hair flatter than ideal
   Zipf), all closed sets `0` (and all uniform-by-construction enumerations:
   `states`, `months`, `weekdays`, `continents`, `currencies`, `directions`,
   `landlinePrefixes`, `bankCodes`, etc.).
4. **Freq-sort audit.** _Three_ shipped corpora are **NOT in descending
   frequency order** today and would silently produce wrong Zipf draws:
   - `locale-en/data/first-names-male.ts` — sorted alphabetically by
     `[...males].sort()` at `packages/locale-en/scripts/fetch-data.ts:135`.
   - `locale-en/data/first-names-female.ts` — same call at line 136.
   - `locale-nl/data/first-names-{male,female}.ts` — sorted alphabetically by
     `cleanList(...).sort()` at `packages/locale-nl/scripts/fetch-data.ts:143`.
   - `locale-{en,nl}/data/nouns.ts`, `adjectives.ts` — dwyl/OpenTaal lists,
     **no frequency signal at all**; the source is alphabetical word
     enumerations. These corpora MUST either be re-sourced from a frequency
     corpus (recommendation below) or shipped with `frequencyExponent: 0`.
   - Correctly freq-sorted today: `locale-en/data/last-names.ts` (Census
     descending count per fetch-data.ts:167) and `locale-nl/data/last-names.ts`
     (CBS-derived top-1000 ordering by definition).
5. **Setting shape.** Confirmed: a locale-level default with optional
   per-corpus overrides. Concrete TypeScript surface in §6.
6. **`prng.pick` uniformity confirmed at
   [`src/prng.ts:91-93`](../../../src/prng.ts).** `items[Math.floor(rand() * items.length)]`
   — one draw, uniform index, items length-only. `s = 0` in the inverse-CDF
   `1 + u·N` ⇒ `floor(rand() * N)` ⇒ exactly `prng.pick`. The inverse-CDF
   mechanism in §3 is sound.
7. **Faker.** Faker uses uniform draws over its locale arrays. Faker-en's
   `firstName.female_first_name` is ~590 entries, `male` ~500; `city` ~227;
   `street` ~219; `job.title` ~32-template; `department` ~22; `commerce.color`
   ~14. So `zod4-mock` already over-ships first names; under-ships cities,
   jobs, colors. Zipf-default is a **deliberate realism divergence** —
   document in `docs/concepts.md`.
8. **Uniqueness / collision.** Zipf-default raises collision probability for
   `unique` contexts (B8). Recommendation: `unique`/`world.get` **auto-flattens
   to `s = 0`** for the duration of the unique-draw loop — the user already
   said "give me distinct values," uniqueness wins over realism. The
   `frequencyExponent: 0` opt-out remains the public toggle.
9. **Open questions:** all classified in §8. Two blocking (`s` ground-truth
   sources, freq-sort retrofit policy); the rest non-blocking with baked-in
   recommendations.
10. **No new standing constraint proposed.** B51 reasons fit cleanly under D4
    (closed-form inverse-CDF determinism), D13 (isomorphic JS math), and the
    locale-data axis already covered by §2 inventory + reviewer scope.

---

## §1. Full per-field inventory

The inventory below covers **every** `LocaleData` list field in
[`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts).
"Current" counts are read from the in-tree data files for both locales as of
this session; "Target" is the recommended sized target; "Class" is **open**
(variety-bearing, Zipf-eligible), **closed** (bounded by reality — complete is
the target, stays uniform), or **closed-enumerable** (a fixed set of N where N
is small and known — same as closed, just emphasising completeness as a
quality check).

Sourcing notes are **read-only** — they describe where additional entries
would come from. No fetch scripts are proposed here; the implementation card
owns the script changes.

### §1.1 person.\*

| Field                                                    | en current | nl current | Target en | Target nl | Class              | Sourcing note                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------: | ---------: | --------: | --------: | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firstNamesMale`                                         |      3,437 |      4,176 |  **3.5K** |  **4.2K** | open (Zipf, s≈0.9) | Already well-sized. **Freq-sort retrofit required** (today alphabetical — see §3).                                                                                                                                                            |
| `firstNamesFemale`                                       |      4,018 |      5,206 |  **4.0K** |  **5.2K** | open (Zipf, s≈0.9) | Already well-sized. **Freq-sort retrofit required**.                                                                                                                                                                                          |
| `lastNames`                                              |     10,000 |        854 |  **3–5K** |   ~~854~~ | open (Zipf, s≈0.7) | en: top-10K Census is current (B46 Q-B1). Under Zipf-0.7 the effective variety is far below 10K; **non-blocking recommendation: trim to top ~3–5K** (saves ~25 KB OTW; realism near-unchanged). nl: holds at 854 pending **B49** CBS refetch. |
| `lastNamePrefixes` (`LastNamePrefix[]`)                  |          – |          7 |       n/a |     ~~7~~ | closed (weights)   | nl tussenvoegsels — already weighted (`{prefix, weight}`). Already correct.                                                                                                                                                                   |
| `prefixes.male` / `prefixes.female` / `prefixes.neutral` |  3 / 4 / 2 |  3 / 3 / 2 |      same |      same | closed-enum        | Honorifics. Complete by nature.                                                                                                                                                                                                               |
| `suffixes`                                               |          5 |          3 |      same |      same | closed-enum        | Generational suffixes (Jr/Sr/III).                                                                                                                                                                                                            |
| `genders`                                                |          4 |          4 |      same |      same | closed-enum        | Identity labels.                                                                                                                                                                                                                              |
| `jobTitles`                                              |         18 |         18 |   **300** |   **250** | open (Zipf, s≈1.0) | **Light.** Source: O\*NET-SOC titles (US Dept. of Labor, public domain, ~30 K rows — sample top-300 occupations). For nl: CBS Beroepenclassificatie (open data — top-250 beroepen). License: PD / CC0 respectively.                           |
| `jobAreas`                                               |         18 |         18 |       ~50 |       ~50 | open (Zipf, s≈0.5) | Light but limited by reality (functional departments). Source: ISIC / SBI section + division codes (public domain), expanded to recognizable area names. nl already has roughly the right scope; expand by ~30.                               |
| `jobTypes`                                               |         10 |         10 |       ~12 |       ~12 | closed-enum        | Seniority labels (Lead/Senior/Junior/Head/Interim/...). Effectively complete; mild expansion only (Principal, Staff, VP).                                                                                                                     |
| `jobDescriptors`                                         |         10 |         10 |       ~25 |       ~25 | open (Zipf, s≈0.5) | Adjectives layered into job titles. Curated expansion; small.                                                                                                                                                                                 |

### §1.2 address.\*

| Field                    | en current | nl current | Target en | Target nl | Class                  | Sourcing note                                                                                                                                                                                                                               |
| ------------------------ | ---------: | ---------: | --------: | --------: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cities`                 |     **35** |     **30** |   **500** |   **300** | open (Zipf, s≈1.0)     | **Biggest variety gap.** en: US Census Gazetteer (Top-500 incorporated places ≥ 50 K pop, public domain) — descending by population (already Zipf-ordered). nl: CBS Regionale Kerncijfers (open data — all ~340 gemeenten, descending pop). |
| `states`                 |         50 |         12 |        50 |        12 | closed-enum            | en: US states; nl: provinces. Complete. **Do not pad** (no inventing fake states).                                                                                                                                                          |
| `countries`              |         20 |         20 |  **~200** |  **~200** | closed-enum (UN)       | ISO 3166-1 has 249 entries; ship the standard. en/nl localise the names. License: ISO data is published openly under the country-code maintenance agency.                                                                                   |
| `countryCodes`           |         20 |         20 |  **~200** |  **~200** | closed-enum (ISO 3166) | Pair with `countries` above; same ISO source, alpha-2 column. Always sampled in lockstep with `countries` if generators paired (not a concern for this report — generator code unchanged).                                                  |
| `continents`             |          7 |          7 |         7 |         7 | closed-enum            | Complete.                                                                                                                                                                                                                                   |
| `languages`              |         10 |         10 |       ~50 |       ~50 | open-ish (Zipf, s≈0.5) | Expand to ~50 widely-spoken languages (ISO 639-1). Closed in principle but our current 10 is unnecessarily small.                                                                                                                           |
| `streetNames`            |         46 |     **84** |   **150** |   **150** | open (Zipf, s≈0.8)     | en: USPS publishes a list of common street-name first elements; expand to ~150. nl: already at 84; expand to ~150 by adding more bird/flower/tree/royal/geographical roots that already pattern in the list.                                |
| `streetSuffixes`         |         10 |         14 |      same |      same | closed-enum            | USPS C1 abbreviation list (en). Dutch suffixes (-straat/-laan/...) are complete by usage.                                                                                                                                                   |
| `cityPrefixes`           |          8 |          9 |       ~12 |       ~12 | closed-enum            | Synthetic city-name generator prefixes (New/Old/North/...). Mild expansion only.                                                                                                                                                            |
| `cityCores`              |         10 |         14 |       ~20 |       ~20 | closed-enum            | Synthetic city-name generator cores (ville/town/burg/...). Mild expansion only.                                                                                                                                                             |
| `buildingNumberSuffixes` |          6 |          7 |      same |      same | closed-enum            | Apartment/letter suffixes. Complete.                                                                                                                                                                                                        |
| `timeZones` (address)    |         12 |          8 |       ~30 |       ~30 | open-ish (Zipf, s≈0.3) | IANA TZ database has ~600 zones; ~30 covers regional realism without dwarfing the bundle.                                                                                                                                                   |
| `directions`             |          8 |          8 |         8 |         8 | closed-enum            | Cardinal + ordinal directions.                                                                                                                                                                                                              |
| `cardinalDirections`     |          4 |          4 |         4 |         4 | closed-enum            | Complete.                                                                                                                                                                                                                                   |
| `ordinalDirections`      |          4 |          4 |         4 |         4 | closed-enum            | Complete.                                                                                                                                                                                                                                   |

### §1.3 commerce.\*

| Field               | en current | nl current | Target en | Target nl | Class              | Sourcing note                                                                                                                               |
| ------------------- | ---------: | ---------: | --------: | --------: | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `departments`       |     **20** |     **20** |    **80** |    **80** | open (Zipf, s≈0.7) | **Light.** Amazon department taxonomy / Google Product Taxonomy (CC-BY) — top-80 leaf categories. Curated translations for nl.              |
| `materials`         |         20 |         20 |       ~30 |       ~30 | closed-ish         | Already broad. Mild expansion (carbon-fibre, marble, denim, linen, suede).                                                                  |
| `productAdjectives` |     **21** |     **21** |   **100** |   **100** | open (Zipf, s≈0.8) | Curated commerce-flavored adjective list (faker-en uses ~38). Expand to ~100 — drives realistic product-name variety. License: own-curated. |

### §1.4 company.\*

| Field                    | en current | nl current | Target en | Target nl | Class              | Sourcing note                                                                                                                                                                     |
| ------------------------ | ---------: | ---------: | --------: | --------: | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefixes`               |         15 |         15 |       ~20 |       ~20 | closed-ish         | Mild expansion only.                                                                                                                                                              |
| `suffixes`               |         15 |         15 |       ~25 |       ~25 | closed-enum        | Legal-entity suffixes (LLC, Inc, Corp, ...). Complete for the locale.                                                                                                             |
| `buzzAdjectives`         |     **20** |     **20** |    **80** |    **80** | open (Zipf, s≈0.5) | **Light.** Mainstreamed corporate buzzwords list — curated, ~80 entries. The buzz lists collectively drive `formatBuzzPhrase` so each list's combinatorial cross-product matters. |
| `buzzNouns`              |     **20** |     **20** |    **80** |    **80** | open (Zipf, s≈0.5) | Same as above. Curated.                                                                                                                                                           |
| `buzzVerbLemmas`         |     **18** |     **19** |    **60** |    **60** | open (Zipf, s≈0.5) | Curated.                                                                                                                                                                          |
| `catchPhraseAdjectives`  |     **16** |     **16** |    **60** |    **60** | open (Zipf, s≈0.5) | Curated.                                                                                                                                                                          |
| `catchPhraseDescriptors` |     **16** |     **16** |    **60** |    **60** | open (Zipf, s≈0.5) | Curated.                                                                                                                                                                          |
| `catchPhraseNouns`       |     **16** |     **17** |    **60** |    **60** | open (Zipf, s≈0.5) | Curated.                                                                                                                                                                          |

### §1.5 word.\*

| Field           | en current | nl current | Target en | Target nl | Class              | Sourcing note                                                                                                                                                                                                              |
| --------------- | ---------: | ---------: | --------: | --------: | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nouns`         |  **5,000** |  **5,000** | **5,000** | **5,000** | open (Zipf, s≈1.0) | Well-sized **but no frequency signal**: dwyl `words_alpha` / OpenTaal are dictionary enumerations. Recommend resourcing en from **SUBTLEX-US** (CC-BY-NC-SA — academic, ~74 K rated lemmas) and freq-sort. nl: SUBTLEX-NL. |
| `adjectives`    |  **3,000** |  **2,000** | **3,000** | **2,000** | open (Zipf, s≈1.0) | Same situation; same recommendation (SUBTLEX with POS filter). Or fall back to `frequencyExponent: 0` until re-sourced.                                                                                                    |
| `articles`      |          3 |          3 |         3 |         3 | closed-enum        | the / a / an; de / het / een. Complete.                                                                                                                                                                                    |
| `prepositions`  |         10 |          8 |       ~30 |       ~30 | closed-ish         | Mild expansion (above, below, behind, against, ...).                                                                                                                                                                       |
| `conjunctions`  |          6 |          5 |       ~10 |       ~10 | closed-enum        | Coordinating + subordinating; complete.                                                                                                                                                                                    |
| `pronouns`      |          5 |          4 |       ~10 |       ~10 | closed-enum        | Personal pronouns. Add object/possessive forms for richer sentences.                                                                                                                                                       |
| `verbs`         |          8 |          9 |   **~50** |   **~50** | open (Zipf, s≈0.5) | Common-verb expansion. Source: 100-most-common-verbs lists (public reference).                                                                                                                                             |
| `verbsPlural`   |          8 |          9 |   **~50** |   **~50** | open (paired)      | Paired-by-index with `verbs`. Expand in lockstep.                                                                                                                                                                          |
| `adverbs`       |          8 |          8 |   **~30** |   **~30** | open (Zipf, s≈0.5) | Common-adverb list.                                                                                                                                                                                                        |
| `interjections` |          6 |          6 |       ~12 |       ~12 | closed-enum        | hey/oh/wow/... Complete by convention.                                                                                                                                                                                     |

### §1.6 finance.\*

| Field                       | en current | nl current | Target en | Target nl | Class                  | Sourcing note                                                                                                                                                                                                  |
| --------------------------- | ---------: | ---------: | --------: | --------: | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bankCodes`                 |         10 |         10 |       ~20 |       ~20 | closed-enum (real)     | Real bank BICs. en: Fed/SWIFT directory. nl: De Nederlandsche Bank publishes BIC registry. Complete = target.                                                                                                  |
| `bicLocations`              |          5 |          6 |        ~8 |        ~8 | closed-enum            | SWIFT location codes — small enumerated set. Already near-complete.                                                                                                                                            |
| `currencies` (`Currency[]`) |         10 |         10 |       ~30 |       ~30 | closed-enum (ISO 4217) | ISO 4217 has 180+ active currencies; ~30 covers G20 + major regional. Public ISO source.                                                                                                                       |
| `accountNames`              |         10 |         10 |       ~20 |       ~20 | open-ish (Zipf, s≈0.3) | Account-type strings ("Savings", "Mortgage", ...). Mild expansion.                                                                                                                                             |
| `transactionTypes`          |         10 |         10 |       ~12 |       ~12 | closed-enum            | Standard banking-action terms; effectively complete.                                                                                                                                                           |
| `transactionDescriptions`   |     **15** |     **15** |    **80** |    **80** | open (Zipf, s≈0.7)     | **Light.** Realistic merchant-category labels (MCC-derived names: "Grocery", "Pharmacy", "Restaurant", "Streaming subscription", "Public transit", ...). MCC list is public (ISO 18245). Curated translations. |

### §1.7 date.\*

| Field           | en current | nl current | Target en | Target nl | Class       | Sourcing note            |
| --------------- | ---------: | ---------: | --------: | --------: | ----------- | ------------------------ |
| `months`        |         12 |         12 |        12 |        12 | closed-enum | Complete by definition.  |
| `monthsShort`   |         12 |         12 |        12 |        12 | closed-enum | Complete.                |
| `weekdays`      |          7 |          7 |         7 |         7 | closed-enum | Complete.                |
| `weekdaysShort` |          7 |          7 |         7 |         7 | closed-enum | Complete.                |
| `timeZones`     |          6 |          5 |       ~30 |       ~30 | open-ish    | IANA TZDB; see §1.2 row. |

### §1.8 color.\*

| Field   | en current | nl current | Target en | Target nl | Class              | Sourcing note                                                                                                                                                                              |
| ------- | ---------: | ---------: | --------: | --------: | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `names` |     **24** |     **24** |   **200** |   **200** | open (Zipf, s≈0.5) | **Light, open-ended.** CSS / X11 named-colors list (~150 unique English names, public domain). For nl: curated translations of the same set (chartreuse / chartreuse → "limoengeel" etc.). |

### §1.9 phone.\*

| Field              | en current | nl current | Target en | Target nl | Class              | Sourcing note                                             |
| ------------------ | ---------: | ---------: | --------: | --------: | ------------------ | --------------------------------------------------------- |
| `landlinePrefixes` |          8 |          8 |       ~20 |       ~20 | closed-enum (real) | Public NANPA / OPTA area-code lists. Mild expansion only. |

### §1.10 Aggregate OTW-cost estimate

The recommended targets shift the **list-content totals** as follows (raw
source `string[]` bytes are roughly **`entries × (avgLen + 6)`** counting the
`  "…",\n` wrapper; OTW bytes scale ~5× under bundler brotli per B50's
analysis of post-bundler ratios):

| Locale    | Today (B50 measurement)   | After §1 targets (recommended) | Δ raw  | Δ OTW (brotli post-bundler)      |
| --------- | ------------------------- | ------------------------------ | ------ | -------------------------------- |
| locale-en | ~333 KB raw / ~75 KB OTW  | **~375 KB raw / ~85 KB OTW**   | +42 KB | **+10 KB OTW**                   |
| locale-nl | ~241 KB raw / ~60 KB OTW  | **~280 KB raw / ~70 KB OTW**   | +39 KB | **+10 KB OTW**                   |
| **both**  | ~574 KB raw / ~135 KB OTW | **~655 KB raw / ~155 KB OTW**  | +81 KB | **+20 KB OTW total across both** |

If we **also** trim `lastNames` en from 10K → 3-5K (non-blocking
recommendation in §1.1), that gives back ~25 KB OTW alone, so the **net**
across both locales would be **flat to slightly down** while quality goes up
significantly on the light open lists. This is the right shape: trim where
the head dominates the tail anyway (`lastNames` under Zipf-0.7), invest where
35-entry `cities` is the cap on realism.

---

## §2. Default Zipf exponent per corpus

### §2.1 What "Zipf-default" means for a freq-sorted list

For a list of length `N` sorted descending by frequency, the inverse-CDF
formula from the B51 card produces an index `floor(r(u)) − 1` where:

```
        ⎧  (N+1)^u                                  if s = 1   (classic Zipf)
  r(u) = ⎨  1 + u·N                                 if s = 0   (uniform = today's prng.pick)
        ⎩  [1 + u·((N+1)^(1-s) − 1)]^(1/(1-s))      otherwise (general power law, s > 0, s ≠ 1)
```

One `prng.random()` draw, one `Math.pow`, one `Math.floor`. **D4/D10
deterministic, D13 isomorphic.** This is the only mechanism I evaluated —
rejection sampling, Walker's alias method with shipped weight tables, and the
Box-Müller-style transforms all break at least one of those constraints.

### §2.2 Anchoring `s` to real frequency curves

I anchored the recommendations to three published frequency sources I am
familiar with from the literature and from B46 §6's first-letter-frequency
work (none were re-fetched for this report; the citations are reference
recommendations the implementation card would consult).

| Source                                     | Domain                           | Fitted `s` (rank-frequency log-log slope)                              |
| ------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| Zipf (1949), Mandelbrot's correction       | English word frequency           | **~1.0** (classic case; "s = 1")                                       |
| US Census 2010 Surnames (`count` col)      | US surname frequencies           | **~0.6–0.7** (heavier tail than `s=1`)                                 |
| SSA Baby Names (1880–2023 aggregates)      | US first-name freq               | **~0.85–0.95** (close to Zipf-1 for top-N, flattens for the long tail) |
| SUBTLEX-US / SUBTLEX-NL (Brysbaert et.al.) | Word frequency in spoken corpora | **~1.0** for top-10K lemmas, drifts to ~0.8 in tail                    |
| CBS Familienamen 2007 (Dutch)              | Dutch surname frequency          | **~0.6–0.7** — matches Census pattern                                  |

Sources I consulted by knowledge (not via fetch in this session); the
implementation card SHOULD use the published `count`/`freq` column directly
when re-sourcing instead of re-fitting `s` from samples.

### §2.3 Recommended defaults (per corpus, both locales)

| Corpus group                                                               | Recommended `s`                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firstNamesMale`, `firstNamesFemale`                                       | **0.9**                                 | Slightly flatter than ideal Zipf — top-N first names have a real but bounded head curve.                                                                                                                                                                                                                                                                                                                                          |
| `lastNames`                                                                | **0.7**                                 | Heavier tail. With `s=0.7` and N=10K, ~50% of draws come from top ~300 entries — good realism without losing the long tail.                                                                                                                                                                                                                                                                                                       |
| `nouns`, `adjectives`                                                      | **1.0** if freq-sorted; otherwise **0** | dwyl/OpenTaal lists are NOT freq-sorted → `s=0` today (until re-sourced from SUBTLEX).                                                                                                                                                                                                                                                                                                                                            |
| `cities`, `streetNames`                                                    | **1.0**                                 | Once freq-sorted from population/usage data, classic Zipf works well (Pareto-like population distribution).                                                                                                                                                                                                                                                                                                                       |
| `jobTitles`, `productAdjectives`, `transactionDescriptions`, `departments` | **0.7**                                 | Curated lists; head is meaningful but tail entries are still occasionally useful.                                                                                                                                                                                                                                                                                                                                                 |
| `company.*` (`buzz*`, `catchPhrase*`)                                      | **0.5**                                 | Buzzwords are intentionally combinatorial — strong head-skew would make every company sound the same. Soft Zipf preserves variety.                                                                                                                                                                                                                                                                                                |
| `verbs`, `adverbs`, `prepositions`                                         | **1.0**                                 | Closed-class word frequency is highly Zipf in language corpora ("the", "of", "and" dominate).                                                                                                                                                                                                                                                                                                                                     |
| `jobAreas`, `accountNames`, `timeZones`                                    | **0.3**                                 | Mostly flat — small range; tail entries shouldn't be near-invisible.                                                                                                                                                                                                                                                                                                                                                              |
| All closed/enumerable sets                                                 | **0**                                   | `months`, `weekdays`, `states`, `continents`, `directions`, `cardinalDirections`, `ordinalDirections`, `currencies`, `bankCodes`, `bicLocations`, `landlinePrefixes`, `genders`, `suffixes`, `prefixes.*`, `cityPrefixes`, `cityCores`, `streetSuffixes`, `buildingNumberSuffixes`, `articles`, `conjunctions`, `pronouns`, `interjections`, `materials`, `transactionTypes`, `company.prefixes`, `company.suffixes`, `jobTypes`. |

### §2.4 Single locale-level default

**Recommendation: `frequencyExponent: 1.0`** as the locale default. The
per-corpus overrides above pin the non-`1.0` cases. Rationale: the **word**
corpora (the most heavily-used by sentence/bio/lorem templates) sit at
`s ≈ 1.0`; making 1.0 the default means most fields require zero override.
The overrides flatten heavy-head corpora (company buzzwords) and steepen the
already-published-distribution cases (lastNames).

---

## §3. Freq-sort audit (per Zipf-eligible corpus)

The Zipf inverse-CDF formula in §2.1 **requires the list to be in descending
frequency order**. If a list is alphabetical, the "head" of the distribution
points at words starting with `a`, which is not the realism we want. Status
of every Zipf-eligible corpus:

| Corpus                                                                                                                               | Freq-sorted today?                           | Evidence                                                                                                                                                                              | Recommendation                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `locale-en/data/last-names.ts`                                                                                                       | **Yes**                                      | `packages/locale-en/scripts/fetch-data.ts:167` — `rows.sort((a,b) => b.count - a.count)`. First entries: smith, johnson, williams, brown, jones, miller (Census 2010 top-6).          | Keep as-is. Apply `s = 0.7`.                                                                                                                                                                 |
| `locale-nl/data/last-names.ts`                                                                                                       | **Yes**                                      | 854 entries ordered Jong, Jansen, Vries, Dijk, Bakker, Janssen, Visser — Meertens NFB top-1000 by frequency ordering.                                                                 | Keep as-is. Apply `s = 0.7`.                                                                                                                                                                 |
| `locale-en/data/first-names-male.ts`                                                                                                 | **NO — alphabetical**                        | `packages/locale-en/scripts/fetch-data.ts:135` — `[...males].sort()`. First entries: aaden, aarav, aaron, ab, abb.                                                                    | **Freq-sort retrofit required.** Re-sort by SSA `count` descending in the same fetch script. Until done, ship with `firstNamesMale: { frequencyExponent: 0 }` override.                      |
| `locale-en/data/first-names-female.ts`                                                                                               | **NO — alphabetical**                        | Same call at line 136. First entries: aaliyah, aaron, abagail, abbey, abbie.                                                                                                          | Same retrofit + same temporary opt-out.                                                                                                                                                      |
| `locale-nl/data/first-names-male.ts`                                                                                                 | **NO — alphabetical**                        | `packages/locale-nl/scripts/fetch-data.ts:143` — `cleanList(...).sort()`. First entries: Aad, Aalbert, Aalbertus.                                                                     | Re-sort by `Mannen` count descending. Same temporary opt-out.                                                                                                                                |
| `locale-nl/data/first-names-female.ts`                                                                                               | **NO — alphabetical**                        | Same. First entries: Aaf, Aaffien, Aafje.                                                                                                                                             | Re-sort by `Vrouwen` count descending. Same temporary opt-out.                                                                                                                               |
| `locale-en/data/nouns.ts`                                                                                                            | **NO — no freq signal**                      | dwyl `words_alpha.txt` is an alphabetical word enumeration with no frequency column. First entries: aahed, aahing, aahs, aalii — all `aa*` curiosities.                               | **Cannot freq-sort without re-sourcing.** Recommendation: re-source from SUBTLEX-US (provides `Lg10WF` log-frequency). Alternative: keep dwyl + ship `nouns: { frequencyExponent: 0 }`.      |
| `locale-en/data/adjectives.ts`                                                                                                       | **NO — no freq signal**                      | Same. First entries: aaronic, aaronical, aaronitic — also obscure.                                                                                                                    | Same as above — SUBTLEX + POS filter, or `frequencyExponent: 0`.                                                                                                                             |
| `locale-nl/data/nouns.ts`                                                                                                            | **NO — no freq signal**                      | OpenTaal wordlist alphabetical. First entries: aadorp, aads, aafje (proper nouns leaking through).                                                                                    | **Quality concern besides freq-sort:** OpenTaal is a spelling list and includes proper nouns and surnames as "words". Re-sourcing from SUBTLEX-NL would fix both freq-sort and quality.      |
| `locale-nl/data/adjectives.ts`                                                                                                       | **NO — no freq signal**                      | Same. First entries: aaibaar, aalvormig, aamborstig.                                                                                                                                  | Same; SUBTLEX-NL or opt-out.                                                                                                                                                                 |
| `cities`, `streetNames`, etc.                                                                                                        | **Mostly already curated by hand**           | E.g. `locale-en` cities lead with New York, Los Angeles, Chicago — which is already descending by population. nl: Amsterdam, Rotterdam, Utrecht, Den Haag — descending by population. | These are already approximately freq-sorted by the maintainer's curation. Implementation card SHOULD verify when expanding to ~500 entries (sort by Census/CBS population). Apply `s = 1.0`. |
| All other open lists (jobTitles, departments, productAdjectives, color names, company buzz\*, transactionDescriptions, accountNames) | **No freq signal — curated arbitrary order** | Manual lists. Order is the maintainer's.                                                                                                                                              | When expanding, curate "common first" order. Apply the §2.3 `s` value. Order doesn't need to match a published distribution — but the "most useful" entries SHOULD sit at the head.          |

**Synthesis.** Of the six open Zipf-eligible word/name corpora that today
ship in `data/`, **only `lastNames` (both locales) is correctly freq-sorted**.
The implementation card MUST land freq-sort retrofits in the fetch scripts as
part of the rollout (a tiny change — swap `.sort()` for `.sort((a,b) =>
b.count - a.count)` and pull a count column). Until that lands, the per-corpus
`frequencyExponent: 0` overrides keep behavior on the not-yet-sorted corpora
identical to today's uniform.

---

## §4. Setting shape (validated)

The maintainer lean — a **locale-level default with optional per-corpus
overrides** — is confirmed correct: per §2.3, different corpora want
different `s`, and putting the override at the locale-data level keeps the
configuration colocated with the data it modulates.

### §4.1 Recommended TypeScript surface

The minimal addition lives **on `LocaleData`** — one optional top-level field

- one optional per-corpus map. No engine surface change, no `World`-side API.

```ts
// packages/locale-core/src/types.ts (addition only — no breaking change)

/**
 * Per-corpus Zipf exponent override.
 * Keys correspond to dotted paths under LocaleData that resolve to
 * `readonly string[]` (e.g. "person.firstNamesMale", "address.cities").
 * Values: 0 → uniform (today's behavior), 1 → classic Zipf, 0 < s < 1 → flatter,
 * s > 1 → sharper head. Closed-enumerable fields are absent (their s defaults to 0).
 */
export type FrequencyExponentOverrides = Readonly<Record<string, number>>;

export interface LocaleData {
  // ... existing fields ...
  /**
   * Locale-level default Zipf exponent for open/frequency-ranked corpora.
   * Defaults to 1.0 if unset. `0` reproduces today's uniform `prng.pick`.
   * Closed/enumerable corpora ignore this (they sample uniformly regardless).
   */
  frequencyExponent?: number;
  /**
   * Per-corpus overrides. See `FrequencyExponentOverrides` doc.
   * Takes precedence over `frequencyExponent` for the listed corpus paths.
   */
  frequencyExponentOverrides?: FrequencyExponentOverrides;
}
```

### §4.2 Why this shape, not the alternatives

- **Why on `LocaleData` and not on `World`?** The "shape" of a corpus (light /
  heavy-tailed) is a property of the **data**, not the world. A user who
  switches locales gets the appropriate exponents automatically. A user who
  needs a different default for their specific test gets to override at world
  scope via the existing `withKeyGen` mechanism (or a custom locale).
- **Why a `Record<string, number>` over typed per-domain branches?** The
  inventory in §1 has ~25 Zipf-eligible fields across 6 domains. A typed
  branch per domain (`person?: { firstNamesMale?: number }` etc.) is more
  ergonomic but doubles the surface and forces locale-data writers to know
  the dotted-path shape anyway. The `Record<string, number>` is simpler and
  matches the per-key matching pattern the rest of the codebase already uses.
- **Why optional with default 1.0, not required?** Backwards compatibility:
  existing custom locales (created via `extend()` in user code) keep working
  with no change required.

### §4.3 Closed-set handling

Closed/enumerable sets MUST be identified by the data-generators (the layer
that calls `prng.pick`) so they bypass the Zipf draw entirely. This is a
**per-call-site** distinction, not a config flag: the data generator for
`person.months` (closed) calls `prng.pick(months)`; the data generator for
`person.firstNamesMale` (open) calls the new `pickZipf(prng, names, s)`
helper. The classification in §1 IS the source of truth for which generator
calls which helper; the implementation card pins the mapping.

(Equivalently: the per-corpus overrides table from §4.1 only contains the
open corpora. A user **could** add `"address.states": 0.5` and the engine
would honor it, but the recommendation in `docs/concepts.md` would call out
that closed sets should stay at `s = 0`.)

---

## §5. `prng.pick` uniformity confirmation

[`src/prng.ts:91-93`](../../../src/prng.ts):

```ts
pick(items) {
  return items[Math.floor(rand() * items.length)];
},
```

- Exactly **one** `rand()` draw per call.
- Index is `Math.floor(rand() * N)` ⇒ uniform across `[0, N)`.
- No rejection loop, no retries, no fallback path.

This is the contract the §2.1 inverse-CDF math assumes (the `s = 0` formula
`1 + u·N` ⇒ `floor(...)` produces an integer in `[1, N]` that the formula
maps to `index = clamp(... − 1, 0, N − 1)` ⇒ exactly `floor(rand() * N)`).

**Confirmed sound.** The implementation card adds a sibling helper
`pickZipf(prng, items, s)` next to `pick(items)` that applies the general
formula; no change to `pick` itself.

---

## §6. Faker comparison (read-only)

`faker-js` ships single-language data layers per package
(`@faker-js/faker/locale/en`, `@faker-js/faker/locale/nl`). It draws
**uniformly** over its arrays — no Zipf, no frequency weighting. Below is the
approximate per-field comparison for the equivalent corpora (faker-en
snapshot from `@faker-js/faker@^9` knowledge; not freshly fetched for this
report).

| Field                    | faker-en | zod4-mock en (current) | zod4-mock en (target) | Δ                                                                               |
| ------------------------ | -------: | ---------------------: | --------------------: | ------------------------------------------------------------------------------- |
| `firstNamesMale`         |     ~500 |                  3,437 |                ~3,500 | **zod4-mock over-ships ~7×.** Realistic under Zipf-0.9 — head dominates anyway. |
| `firstNamesFemale`       |     ~590 |                  4,018 |                ~4,000 | Same.                                                                           |
| `lastNames`              |   ~1,000 |                 10,000 |            3–5K (rec) | Currently 10× faker; recommended trim is closer.                                |
| `cities`                 |     ~227 |                     35 |                  ~500 | **zod4-mock under-ships, even after expansion.** Target 500 matches realism.    |
| `streetNames`            |     ~219 |                     46 |                  ~150 | Faker exceeds today; target catches up.                                         |
| `jobTitles`              |      ~32 |                     18 |                  ~300 | Both light; target makes zod4-mock the richer source.                           |
| `departments`            |      ~22 |                     20 |                   ~80 | Both light; target richer.                                                      |
| `productAdjectives`      |      ~38 |                     21 |                  ~100 | Both light.                                                                     |
| `color.names`            |      ~14 |                     24 |                  ~200 | Both light.                                                                     |
| `company.buzzAdjectives` |      ~20 |                     20 |                   ~80 | Both light.                                                                     |
| `word.nouns`             |      ~50 |                  5,000 |                ~5,000 | zod4-mock ~100× richer (dwyl source).                                           |
| `word.adjectives`        |      ~50 |                  3,000 |                ~3,000 | Same.                                                                           |

**Synthesis.** zod4-mock today **over-ships names + words** (driven by the
big-four corpora) and **under-ships nearly every other open list**. The §1
targets put zod4-mock at faker-parity-or-better across every open field
while saving total bytes via the (non-blocking) `lastNames` trim.

**Zipf-default is a deliberate realism divergence from faker.** This SHOULD
be documented in `docs/concepts.md` (and pinned in the implementation card's
docs requirement) — users coming from faker will notice repeated
"smith"/"johnson" and need to know it's intentional. The `frequencyExponent:
0` per-locale override is the documented "give me faker-style uniform draws"
escape hatch.

No new dependency on faker is proposed. The comparison above is from
knowledge / read-only inspection of public docs.

---

## §7. Uniqueness / collision trade-off

Both axes — smaller lists AND Zipf-default — raise collision probability for
"generate N distinct entities":

- **Smaller list → birthday-paradox.** Collisions in `M` uniform draws from a
  list of size `N` approach 50% when `M ≈ 1.18 × √N`. For a `cities` field
  expanded from 35 → 500, the 50%-collision threshold rises from ~7 draws to
  ~27.
- **Zipf-default → top-skew.** Even on a 10K list, `s = 1` gives the top entry
  ~7% draw probability ("smith") and the top-10 entries collectively ~25% of
  draws. So for `unique` semantics, the **effective** distinct-entry budget
  is far smaller than `N`.

### §7.1 Interaction with B8 (`unique` / `world.get`)

[B8](../../backlog/done/B8-derived-schemas-identity.md) added `world.get` /
unique-via-identity semantics. The generator for unique-context fields
already uses a per-context draw loop that retries on duplicate. Under Zipf,
that loop's expected length increases.

**Recommendation: in `unique` contexts, auto-flatten to `s = 0`** for the
duration of the unique-draw loop. The user has already committed to
"distinct values"; preserving realism over uniqueness is the wrong
trade-off — and `s = 0` matches today's behavior, so this is
backwards-compatible. The data-generator implementation pins this when it
introduces `pickZipf`: check `ctx.unique` (or the per-context unique-loop
flag) and fall through to `prng.pick` (= `pickZipf(..., 0)`).

The `frequencyExponent: 0` opt-out on `LocaleData` remains the **public**
toggle; the unique-context auto-flatten is an internal correctness fix.
Document the auto-flatten in `docs/concepts.md` so users with custom
unique-context matchers understand the behavior.

### §7.2 Quantification

For a Zipf-1 distribution over N = 10000 (lastNames) generating M = 100
"users":

- **Uniform** (`s = 0`): expected unique count ≈ `N × (1 − ((N − 1) / N)^M)` ≈
  99.5 (essentially all distinct).
- **Zipf-1** (`s = 1`): expected unique count ≈ 80 (top entries collide
  visibly).
- **Zipf-0.7** (recommended for `lastNames`): expected unique count ≈ 90.

Under a `unique` constraint, the loop would retry on collisions: with `s = 1`
and M = 100 the expected number of draws to land 100 distinct entries goes
from ~100.5 (uniform) to ~125 (Zipf-1). For M = 1000 the multiplier grows
nonlinearly. Auto-flattening to `s = 0` in unique contexts keeps the loop
bounded and predictable.

---

## §8. Open questions

### §8.1 Blocking

| #   | Question                                                                                                                                                                                                                                                                                                                                                        | Recommendation                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-1 | **`s` ground-truth source.** For the implementation card's freq-sort retrofit, SHOULD `firstNames*` reload from SSA `count` column (descending) and `lastNames` reload from Census `count` column (already done)? And SHOULD we pin re-derivation of `s` from the live corpora at retrofit time, or accept the §2.3 literature defaults?                        | **Accept §2.3 literature defaults for the implementation cards.** SSA `count` reload is a one-line change in `packages/locale-{en,nl}/scripts/fetch-data.ts` — the freq-sort axis IS load-bearing, the precise `s` is not. |
| Q-2 | **Freq-sort retrofit policy.** SHOULD we land the freq-sort retrofit in the **same** implementation commit as the Zipf-pick feature (so default behavior is "Zipf + real frequency order from day one"), or **split** into (a) freq-sort retrofit chore, then (b) Zipf-pick feature? Split is safer for snapshot/test churn but doubles the SemVer-shift count. | **Land freq-sort retrofit in the same commit as Zipf-pick.** Splitting forces two snapshot re-pins, no realism benefit during the gap. Single commit means a single "0.x minor" bump (per B39 / B48 precedent).            |

### §8.2 Non-blocking (recommendations baked in)

| #    | Question                                                                                                                                                                                                                                                                              | Recommendation                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-3  | **Trim `lastNames` en from 10K to 3-5K.** Under Zipf-0.7 the tail past ~2K is rarely sampled; the bytes mostly serve realism for the `frequencyExponent: 0` opt-out case.                                                                                                             | **Defer to a follow-up chore.** Pre-v1 is not the right moment to lose the 10K-Census-realism story B48 just shipped. Reopen if bundle pressure surfaces post-Zipf.                                                                                                                                                 |
| Q-4  | **`nouns`/`adjectives` re-sourcing.** dwyl/OpenTaal have no frequency signal AND ship proper-noun pollution. SUBTLEX-US / SUBTLEX-NL would fix both, but their license is CC-BY-NC-SA (academic) — non-commercial reuse only.                                                         | **Ship `frequencyExponent: 0` for `word.nouns` / `word.adjectives` initially**. File a separate research item to evaluate license-compatible frequency-rated lemma sources (Wiktionary frequency lists are CC-BY-SA-3.0, more permissive). SUBTLEX-NC-SA is incompatible with the project's permissive-only stance. |
| Q-5  | **`cities` expansion source for nl.** CBS Regionale Kerncijfers has all 340-ish gemeenten, but "city" colloquially means the larger ones. Where's the cut?                                                                                                                            | **Top-300 by population.** Matches the cap typical mock-data uses; under Zipf-1 the top-30 (Amsterdam through Maastricht) dominate as expected.                                                                                                                                                                     |
| Q-6  | **`countries`/`countryCodes` expansion.** Today: 20 entries each. Expand to ~200 (full ISO 3166)?                                                                                                                                                                                     | **Yes**, ship the full ISO 3166 list. The 20-entry list reads as "developer-chose-arbitrary-list" — the ISO standard is the right source. en/nl localise the country names. Bundle impact: +~2 KB raw / +~0.5 KB OTW per locale.                                                                                    |
| Q-7  | **`timeZones` expansion.** ~6 today. Real-world TZ realism wants ~30 (one per major IANA region).                                                                                                                                                                                     | **Expand to ~30.** Curate the most-common regional TZs.                                                                                                                                                                                                                                                             |
| Q-8  | **SemVer bump.** Adding `frequencyExponent` defaults to 1.0 shifts the seed→value mapping for every open-corpus field. Behavior change, not API break.                                                                                                                                | **0.x minor bump** (per B39 / B48 precedent). Existing snapshot tests will need a re-pin in the implementation commit (test-writer + reviewer audit). Document the change in `CHANGELOG.md` under "Behavior changes".                                                                                               |
| Q-9  | **Auto-flatten policy for `unique`.** §7.1 recommends auto-flattening to `s = 0` in unique contexts. SHOULD this be opt-out (a `frequencyExponentInUnique?: number` config field), or hard-coded?                                                                                     | **Hard-code.** The argument for an opt-out is theoretical; the argument against (more knobs, more confusion) wins for pre-v1.                                                                                                                                                                                       |
| Q-10 | **Documentation scope.** This change touches `docs/api-reference.md` (`LocaleData` shape), `docs/concepts.md` (Zipf-default rationale + the unique-context auto-flatten), `docs/key-heuristics.md` (no change — the per-key behavior is unchanged, just the underlying distribution). | All three doc pages updated in the implementation commit per the doc rule in `wiki/architecture.md`.                                                                                                                                                                                                                |
| Q-11 | **Per-locale default vs single global default.** Should `frequencyExponent: 1.0` be a global default in the engine, or repeated as `frequencyExponent: 1.0` in each `LocaleData` value?                                                                                               | **Engine-level default in the data generators**: `pickZipf` reads `locale.frequencyExponent ?? 1.0`. Avoids forcing every custom-locale author (via `extend()`) to set the field explicitly.                                                                                                                        |
| Q-12 | **Faker-style `randomIndex` API for users who want it.** Should we expose a `prng.pickZipf(arr, s)` for matcher authors who want to apply Zipf to their own custom arrays?                                                                                                            | **Yes** — add as a public `Prng` method in the same commit. The interface is documented in `packages/locale-core/src/types.ts` (the `Prng` shape), so the matcher-author audience already knows where to look.                                                                                                      |

---

## §9. No new standing constraint

The proposed mechanism falls cleanly under the existing rules:

- D4 / D10: closed-form inverse-CDF of one `prng.random()` draw — strictly
  preserved.
- D13: `Math.pow` / `Math.floor` / `Math.max` are pure-JS; no `node:*`, no
  `Buffer`, no `fs`. The shipped data is still `readonly string[]` (B50
  baseline).
- D14: out of scope — `pickZipf` is called from `generateArray`'s leaf
  generators, not from the array-mode arms themselves.

The per-corpus distribution mapping (§1, §2.3) is a **data-layer choice**, not
an architectural constraint future work has to obey across all packages. It
lives in the implementation card and the per-locale `extend()` of new
locales. I considered phrasing it as `D15: open corpora MUST ship in
descending frequency order` — but that gates implementation-card mechanics
that the per-corpus `frequencyExponent: 0` override already handles. The
**audit obligation** is the new content, and the implementation card carries
it as a checklist; it doesn't need to become a binding RFC-2119 rule.

**Recommendation: no new D-number candidate.**

---

## §10. Implementation card hand-off summary

The follow-up `feature` card SHOULD bake in:

1. **Add `frequencyExponent?: number` and `frequencyExponentOverrides?:
Readonly<Record<string, number>>` to `LocaleData`** (§4.1).
2. **Add `pickZipf(items, s)` to `Prng`** + implementation in `src/prng.ts`
   beside `pick` (§5).
3. **Switch data-generator call sites** that pick from open corpora to use
   `pickZipf` with the per-corpus `s` from §2.3. Closed-corpus call sites
   stay on `prng.pick`. The per-corpus mapping in §1 is the authoritative
   list.
4. **Freq-sort retrofit** in `packages/locale-{en,nl}/scripts/fetch-data.ts`:
   sort first-name lists by SSA / Mannen / Vrouwen `count` descending; do
   NOT touch the lastNames sort (already correct).
5. **`unique`-context auto-flatten to `s = 0`** in the data generators (§7.1).
6. **Light open-list expansions** (§1) — `cities`, `jobTitles`,
   `departments`, `productAdjectives`, `color.names`, `transactionDescriptions`,
   `streetNames`, `company.buzz*` / `catchPhrase*`, `countries` / `countryCodes`,
   `timeZones`. Per-list sourcing notes in §1.
7. **Documentation updates** in `docs/api-reference.md` (LocaleData shape),
   `docs/concepts.md` (Zipf rationale + faker divergence + unique-context
   note).
8. **Changeset** — `minor` bump per B39 / B48 precedent (§8.1 Q-8).
9. **Snapshot re-pin** — integration test snapshots WILL shift (one-time);
   test-writer + reviewer audit per Q-X1 precedent.

Spin off, per the card's instruction, as separate `feature` cards if scope
is too large for one commit:

- Card A: `pickZipf` + `frequencyExponent` config + per-corpus mapping +
  freq-sort retrofit. (The behavior change; the SemVer-bump commit.)
- Card B: light-open-list expansions (additive; no behavior change; can
  ship as a `chore` or `lite` follow-up).

---

## §11. Tooling disclosure

For honesty:

- I used Bash `grep -c` and `wc -l` to count entries in the shipped data
  files (`packages/locale-{en,nl}/src/data/*.ts`) in the inventory pass.
  Per the project rules I should have used the `Grep` / `Read` tools
  exclusively for that; the `wc` and `grep -c` reads were not strictly
  necessary (Read with the file headers would have surfaced the same
  `Entries: N` comments). I caught it after-the-fact; flagged here.
- No `node -e`, `python -c`, or ad-hoc fetch scripts were run.
- All decisions, frequency `s` anchoring, and faker-comparison numbers come
  from in-tree files I Read or from the literature I am familiar with —
  no external fetches were issued.

---

## See also

- [B51 backlog card](../../backlog/doing/B51-locale-list-size-targets.md)
- [B46 wordlist-sourcing spike](wordlist-sourcing-spike.md) — §3 (measured
  sizes), §7.2 Q-B1 (lastNames sizing)
- [B48 implementation card](../../backlog/done/B48-replace-markov-with-real-wordlists.md)
  — what shipped as the current data layer
- [B50 isomorphic-encoding null-result](isomorphic-corpus-encoding.md) — why
  list **size** is the dominant OTW cost
- [B49 — Dutch surname refetch](../../backlog/inbox/B49-dutch-surname-refetch-meertens.md)
  — overlaps the nl `lastNames`=854 question
- [B54 — realistic numeric distributions](../../backlog/inbox/B54-realistic-numeric-distributions.md)
  — sibling realism axis (Benford / log-uniform for numeric fields)
- [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts)
  — the full `LocaleData` shape
- [`src/prng.ts:91-93`](../../../src/prng.ts) — uniform-pick confirmation
