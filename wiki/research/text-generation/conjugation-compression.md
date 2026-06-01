# On-the-Fly Inflection for Greater Word Variety (B3)

> **Research report for backlog item
> [B3](../../backlog/doing/B3-conjugation-compression.md).** Read-only analysis;
> no code, locale data, schemas, or tests were modified. Anchored to the in-tree
> data generators (`src/generators/data/word.ts`, `person.ts`, `commerce.ts`,
> `company.ts`), the locale-`LocaleData` shape in
> [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts),
> and the shipped surface-form arrays in `packages/locale-{en,nl}/src/`.
>
> **Predecessor:**
> [B51 — Locale corpora size targets + Zipf-distributed picks](locale-list-size-targets.md).
> B51 sets the per-field **size** targets (e.g. `verbs`: 32 → ~50, `adverbs`: 8 → ~30,
> `nouns`: already 5K, `adjectives`: 3K en / 2K nl) and the **distribution** of picks
> (Zipf-default on freq-sorted corpora). Inflection is the **post-pick transform** that
> scales effective variety beyond the surface forms the source list natively carries.
>
> **Siblings:**
> [B54 — Realistic numeric distributions](../../backlog/done/B54-realistic-numeric-distributions.md)
> (independent realism axis; numbers, not words).
> [B48 — Replace Markov with real wordlists](../../backlog/done/B48-replace-markov-with-real-wordlists.md)
> (the rewrite that produced the shipped `readonly string[]` data layer this report
> assumes).
>
> **Binding constraints:** D4 / D10 (determinism — one `prng.random()` per pick, the
> inflection transform consumes **zero** PRNG state), D13 (isomorphism — pure JS string
> manipulation; no `node:*`, no `Buffer`, no `fs`/`zlib`/`process`, no `Intl`-locale
> dependence), D11 (canonical `PIPELINE` unchanged; inflection sits one layer deep in
> the data generators), D14 (`generateArray` trailing pass unchanged).

> **Scope reframe (2026-06-01).** The original B3 page (the "Conjugation-Based Word
> Compression" content this file replaces) was framed as a **bundle-size** lever
> (~30–50% smaller corpora by storing lemmas instead of surface forms). That
> motivation is moot post-B48: the Markov package is gone, and B50 showed shipped
> `string[]` are already at ~70 KB OTW for locale-en / ~41 KB for locale-nl. The
> surviving lever is **variety** — derive plurals / verb conjugations / adjective
> agreement at generation time so a generator can produce forms the surface list
> doesn't natively carry. This report reasons about that lever in light of B51's
> size + distribution direction.

---

## §0. TL;DR

1. **Inflection consumers (§1).** Five generator call sites would meaningfully
   benefit, ordered by realism gap:
   - `src/generators/data/word.ts` `sentence()` lines 122–152 — biggest gap: present-tense
     `verbs` only, no past / participle / 3-person agreement; no plural noun forms; no
     adverb formation.
   - `src/generators/data/word.ts` `adverb()` line 96 — today picks from a tiny
     8-entry list (`adverbs`). For English, every `-ly`/`-ily`/`-ly` adverb is derivable
     from `adjectives` (3 000 lemmas) and would explode variety ~375× **with no new
     data**. Dutch has no productive single-suffix adverb rule, so this win is English-only.
   - `src/generators/data/company.ts` `buzzPhrase()` line 37 — already lemma-driven
     (`buzzVerbLemmas` per B51 §1.4); the `formatBuzzPhrase` template emits the lemma raw.
     Inflecting to `-ing` (en) or to first-/third-person (nl `optimaliseert` /
     `optimaliseren`) makes "Robust scalable infrastructure" sound less like a buzzword
     dictionary.
   - `src/generators/data/commerce.ts` `productName()` line 21 — `formatProductName`
     emits `<adjective> <material> <noun>`; in nl the locale already pluralises material
     with a hardcoded `+en` suffix (`packages/locale-nl/src/locale.ts:447`). Generalising
     that to proper Dutch plural rules (`+en` / `+s` / `+eren`) on the `noun` argument
     fixes singular/plural mismatch ("Klein houten schoenen" vs "Klein houten schoen").
   - `src/generators/data/person.ts` `bio()` line 158 + each locale's `formatBio` —
     low gap; today the locale templates already inflect by hardcoding ("specializing
     in", "gespecialiseerd in"). Adding generic rules would let custom locales reuse
     the verb base without re-templating, but the existing `formatBio` callbacks already
     own the inflection.

2. **Per-locale rule + irregular-list footprint (§2).**
   - **English** — extremely small. Five rule functions
     (`verbPresent3ps`, `verbGerund`, `verbPast`, `pluralize`, `adjectiveToAdverb`),
     ~25–60 LOC each. Irregular lists: ~180 irregular verbs (the conventional list
     spans ~200 with the "is/are/was/were" copula included), ~50 irregular plurals,
     ~30 adjective-to-adverb exceptions (`good→well`, `fast→fast`). **Total: ~150 LOC
     of rules + ~260 irregular-list entries ≈ 5–6 KB of new code per locale package.**
   - **Dutch** — moderate. Verb conjugation needs the `'t kofschip` stem-final
     consonant rule (~12 LOC) and per-tense rule functions for
     `tegenwoordige tijd` (3 forms), `verleden tijd` (regular -de/-te + ~150 sterke
     werkwoorden), `voltooid deelwoord` (regular ge…-d/-t + sterke list). Adjective
     `-e` agreement adds a single rule with an exception for "het"-words used
     indefinitely (~30 LOC including a small unalterable-adjective allowlist:
     `roze`, `oranje`, ending-in-`-en`/`-a`/`-e`). Plural needs `+en` / `+s` /
     `+eren` selection with vowel-doubling/e-dropping rules (~40 LOC) + the
     ~30–50 onregelmatige meervouden list (`kind→kinderen`). **Total: ~250–300 LOC
     of rules + ~250 irregular entries ≈ 8–10 KB per locale package.**

3. **Pipeline placement (§3).** Inflection lives **inside** the data generators
   (`src/generators/data/word.ts`, `commerce.ts`, `company.ts`) and the locale's
   `formatBio`/`formatBuzzPhrase`/`formatProductName` callbacks on `LocaleData`. The
   canonical `PIPELINE` in `src/pipeline.ts` is **unchanged**; `generateArray`'s
   trailing pass (D14) is unchanged; `Prng` shape is unchanged. The mechanism is
   compatible with B48's "shipped data is `readonly string[]`" baseline.

4. **Determinism / isomorphism (§4).** Each call site consumes the same
   `prng.random()` budget it does today (one draw per `pick` / `pickZipf`); the
   inflection transform is pure string manipulation + a `Record<string,string>`
   lookup. No `node:*`, no `Buffer`, no `Intl.…` (would diverge between Node and
   browser locale data). D4/D10/D13 are preserved by construction.

5. **Composition with B51 / B54 / B55 / B57 (§5).** Inflection composes cleanly:
   the lemma is picked by `prng.pick(verbs)` today / `prng.pickZipf(verbs, s)` post-B51,
   then the inflection rule transforms the result. B54 (Benford on numbers) is an
   independent axis. B48's `readonly string[]` shape is preserved; inflection is a
   **consumer-side** transform that does not touch the data layer's wire shape.

6. **Lemma-list separation (§6).** Recommendation: keep current `verbs` /
   `verbsPlural` / `adjectives` / `nouns` arrays as-is for back-compat. **Add** new
   optional fields on `LocaleData.word` — `verbLemmas?: readonly string[]` (and,
   following B51's precedent which already has `company.buzzVerbLemmas`,
   nothing new is needed there). Inflection is **opt-in per consumer**: `sentence()`
   would read `loc.verbLemmas` if present and apply the chosen tense, else fall back
   to today's `loc.verbs`. This avoids breaking the surface-form fields and lets the
   feature land in either or both locales independently.

7. **Faker comparison (§7).** Faker (`@faker-js/faker`) ships **flat surface lists**;
   `lorem.words()`, `word.verb()`, `word.adjective()` are uniform draws. No
   conjugation, no agreement, no plural inflection. Adopting inflection-at-gen-time in
   `zod4-mock` is a **deliberate variety divergence** — pairs with B51 (Zipf-default)
   and B54 (Benford-default) as the third "deliberately more realistic than faker"
   axis. No `faker` dependency.

8. **Implementation hand-off (§8).** Proposed card id **B58** ("Inflection
   transforms in locale generators"). Split recommended:
   - **B58-A**: English inflection (verb 3ps / gerund / past, plural -s/-es/-ies,
     adjective-to-adverb). Small rule footprint; ships a clear realism win on
     `sentence()` and `adverb()`. Lite gate: borderline — touches ~3 files, no API
     break, but **observable behavior change** for `sentence()` / `adverb()` users,
     so probably **full** track with a regression test that asserts present forms
     for the present-tense slots and gerund forms in the gerund slot.
   - **B58-B**: Dutch inflection (`'t kofschip`, plural rules, adjective `-e`
     agreement). Heavier rule footprint; recommend a dedicated card so the Dutch
     irregulars list can be reviewed in isolation.

9. **No new standing constraint (§9).** Inflection is a closed-form pure-JS
   transform in leaf data generators. D4/D10 (determinism), D13 (isomorphism),
   D11 (PIPELINE), and D14 (`generateArray`) all already cover it. **Recommendation:
   no new D-number.**

10. **Open questions (§10).** Three blocking, six non-blocking. Most heavily-weighted
    question: which `LocaleData` shape to use for opt-in inflection — separate
    `*Lemmas` field (recommended), tagged-union entries, or a new generator callback
    that takes the lemma as input.

---

## §1. Field-by-field inventory of inflection consumers

For each consumer of locale word data, the rows below pin **what gets picked**,
**what gets emitted**, **whether the source corpus today carries the produced form
already or would need lemma re-sourcing**, and the **realism gap** the consumer
currently leaves on the table.

### §1.1 `src/generators/data/word.ts:122-152` — `sentence()`

The 5-template weighted PCFG, preserved across B48:

| Token in template      | Picks from                                               | Current form (B48 baseline)                                                                                                                                                          | Realism gap                                                                                                                                                                                                                                 | Inflection rule needed                                                                                |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `art()` (article)      | `loc.articles`                                           | surface form (`the`/`a`/`an`; `de`/`het`)                                                                                                                                            | None — closed-class, complete                                                                                                                                                                                                               | —                                                                                                     |
| `pron()` (pronoun)     | `loc.pronouns`                                           | surface form (`he`/`she`/`they`; `hij`/`zij`)                                                                                                                                        | Today no object/possessive forms (`him`/`his`; `zijn`/`hem`)                                                                                                                                                                                | None for B58 (just expand `pronouns` per B51)                                                         |
| `pre()` (preposition)  | `loc.prepositions`                                       | surface form                                                                                                                                                                         | None                                                                                                                                                                                                                                        | —                                                                                                     |
| `vrb()` (verb)         | `loc.verbs`                                              | en: 8 third-person-singular present forms (`is`, `has`, `goes`, `makes`, `says`, `sees`, `comes`, `becomes`); nl: 9 third-person forms (`is`, `heeft`, `gaat`, `doet`, `maakt`, ...) | **Largest gap.** Always 3ps present. No past (`went`), no gerund (`going`), no infinitive after modals. Today the PCFG slot 2 emits `She makes` — fine — but slot 1 (`The X N Vbs P A N`) always produces "The big cat is in the box" feel. | en verb 3ps / past / gerund; nl tegenwoordige / verleden / voltooid                                   |
| `vrbp()` (verb-plural) | `loc.verbsPlural`                                        | en: 8 base-form plural agreement (`are`, `have`, `go`...); nl: 9 infinitives (`zijn`, `hebben`, `gaan`...)                                                                           | Same: only one tense. Currently used only in template-5, which forces plural agreement (`X and Y go`).                                                                                                                                      | en bare-form + past; nl infinitive + verleden                                                         |
| `conj()` (conjunction) | `loc.conjunctions`                                       | surface form                                                                                                                                                                         | None                                                                                                                                                                                                                                        | —                                                                                                     |
| `adj()` (adjective)    | → `word.ts` `adjective()` → `loc.adjectives` capitalized | base form (positive degree)                                                                                                                                                          | No comparative (`bigger`) / superlative (`biggest`); no Dutch `-e` agreement before nouns (`mooie auto` vs `mooi huis`)                                                                                                                     | en `-er`/`-est` (low-leverage); nl `-e` rule (high-leverage — applies to almost every templated slot) |
| `n()` (noun)           | → `word.ts` `noun()` → `loc.nouns` capitalized           | base singular form                                                                                                                                                                   | No plural (`The cats are…`); template 5 emits `${n()} ${conj()} ${art()} ${n()}` which reads like singular both times. Plural would diversify outputs even without changing PCFG structure.                                                 | en plural `-s`/`-es`/`-ies`; nl `+en`/`+s`/`+eren`                                                    |

**Source-corpus status.** `loc.verbs` and `loc.verbsPlural` ship **paired surface
forms today** (per B51 §1.5: `verbs` / `verbsPlural` are paired-by-index). Under
inflection-at-gen-time these become **derivable from a single lemma list**
(`verbLemmas`). `loc.adjectives` and `loc.nouns` ship as base (singular, positive)
forms already — those are lemmas, no re-sourcing needed.

**Realism gap synthesis.** `sentence()` today produces grammatically-correct but
**tonally identical** sentences — the verb is always present-tense, the noun is
always singular, the adjective never agrees. For matchers that surface
`sentence()` into snapshot tests / faker-style demos this is the visible
"this is mock data" tell.

### §1.2 `src/generators/data/word.ts:96-98` — `adverb()`

```ts
export function adverb(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.adverbs);
}
```

Per B51 §1.5, en/nl ship 8 adverbs each (target ~30). Surface forms today (`quickly`,
`often`, `always`, `never`, `now`, `then`, `here`, `there` / `snel`, `vaak`, ...).

- **English.** Almost all `-ly` adverbs are derivable from adjectives:
  `adjective + "ly"` with exceptions (`-le` → drop `e` + `y`: simple → simply;
  `-y` → `-ily`: easy → easily; `-ic` → `-ically`: dramatic → dramatically;
  irregulars: good → well, fast → fast, hard → hard). With `adjectives` at 3 000
  entries, the **effective adverb pool grows from 8 → ~3 000** at zero data cost.
  Spatial/temporal adverbs (`here`, `now`, `then`) stay in the closed `adverbs`
  list because they are not adjective-derived.
- **Dutch.** Adverb formation is **NOT** productive from a single suffix — many
  Dutch adjectives can function adverbially in their base form (`snel werk` /
  `snel werken`), and there is no `-ly`-equivalent suffix that applies uniformly.
  **Recommendation: keep `loc.adverbs` as the only adverb source in nl;** the
  inflection lever is English-only here.

**Source-corpus status.** en `adjectives` already ships lemmas (positive base);
the adverb-formation rule reuses those. No data re-sourcing required.

**Realism gap synthesis.** This is the **cleanest variety win** in the report
— a single 30-line rule plus a ~30-entry exception map turns an 8-entry list
into a ~3 000-entry effective pool. The risk: the dwyl `words_alpha` source
(per B51 §3) ships obscure adjectives (`aaronic`, `aaronical`); the rule would
emit `aaronically`, which is technically valid but tonally off. This is an
**existing** problem with the noun/adjective corpus quality (B51 Q-4 — re-source
from SUBTLEX), not something inflection introduces.

### §1.3 `src/generators/data/company.ts:33-44` — `buzzPhrase()` / `buzzVerb()`

```ts
export function buzzVerb(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.buzzVerbLemmas);
}

export function buzzPhrase(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return locale.company.formatBuzzPhrase(
    buzzVerb(prng, ctx),
    buzzAdjective(prng, ctx),
    buzzNoun(prng, ctx),
  );
}
```

The field is **already named `buzzVerbLemmas`** (per B51 §1.4 — confirmed at
`packages/locale-core/src/types.ts:105`). `formatBuzzPhrase` in en
(`packages/locale-en/src/locale.ts:574-575`) emits:

```ts
formatBuzzPhrase: (verb, adj, noun) =>
  `${cap(verb)} ${adj.toLowerCase()} ${noun.toLowerCase()}`,
```

i.e. `Streamline synergistic solutions` — the verb stays in **bare infinitive**.
With inflection:

- en: `Streamlining synergistic solutions` (gerund) or
  `Streamlines synergistic solutions` (3ps) — both more realistic than the
  imperative-feel "Streamline".
- nl: `Stroomlijnen synergetische oplossingen` today;
  `Stroomlijnt synergetische oplossingen` (3ps) reads like a marketing claim.

**Source-corpus status.** `buzzVerbLemmas` is already **lemmas by name and
content** (B51 confirms 18 en / 19 nl entries, infinitive forms). The
`formatBuzzPhrase` callback is locale-owned, so inflection lives inside the
locale's callback, not inside `company.ts` — the rule library has to be
**importable by locale packages**, which means it ships in `@zod4-mock/locale-core`
(see §3).

**Realism gap synthesis.** Medium. Bare verbs are a known buzzword-generator
convention ("synergize", "streamline"), so the gap is smaller than the verb
in `sentence()`. But the **distribution of forms** is the lever: if
`formatBuzzPhrase` rolls 50/50 between bare and gerund, every buzz phrase
isn't formatted identically.

### §1.4 `src/generators/data/commerce.ts:21-28` — `productName()`

```ts
export function productName(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return locale.commerce.formatProductName(
    productAdjective(prng, ctx),
    productMaterial(prng, ctx),
    noun(prng, ctx),
  );
}
```

Locale callbacks (`packages/locale-en/src/locale.ts:415` and
`packages/locale-nl/src/locale.ts:446`):

```ts
// en
formatProductName: (adjective, material, noun) =>
  `${adjective} ${material.toLowerCase()} ${noun}`,
// nl
formatProductName: (adjective, material, noun) =>
  `${adjective} ${material.toLowerCase()}en ${noun}`,
```

The **nl callback already hardcodes a hand-rolled plural** (`material + "en"`).
This is the cleanest "inflection wants a proper home" signal in the codebase:
the hardcoded `"en"` is correct for `metaal → metalen` only by luck (and is
wrong for `glas → glazen`, `wol → wollen`, `bamboe → bamboe` …).

**Source-corpus status.** `materials` and `productAdjectives` ship as base
forms (en) / agreeing-with-singular forms (nl). `noun` comes from
`loc.adjectives`-style lemma. Inflection improvements:

- nl: replace `${material.toLowerCase()}en` with a proper pluralisation/agreement
  rule. Also: `productAdjective` should `-e`-agree with the noun's gender
  (`klein` vs `kleine`).
- en: optionally pluralise the noun (`Ergonomic plastic chairs` vs `chair`)
  conditional on a coin flip; the random-tone variety lives here.

**Realism gap synthesis.** Moderate to high for nl (current hardcoded `"en"` is
a known-incorrect approximation). Low to moderate for en.

### §1.5 `src/generators/data/person.ts:158-166` — `bio()`

```ts
return locale.person.formatBio(prng, { jobTitle: title, jobArea: area, jobType: type });
```

The `formatBio` callbacks (en `packages/locale-en/src/locale.ts:85-95`,
nl `packages/locale-nl/src/locale.ts:94-104`) **already handle their own
inflection** by hand-templating the three sentence shapes. They lowercase the
inputs and concatenate; no productive inflection.

**Realism gap synthesis.** Low — the templates are already locale-specific, and
the inputs are already in the right form (`jobTitle` is a noun, used as a noun
in `working as <jobTitle>`). Inflection would only matter if the templates
wanted past tense (`was working`) or pluralised area, which is not on the menu.

### §1.6 `src/generators/data/word.ts:117` — `words()`

```ts
export function words(prng: Prng, count = 3, ctx?: GeneratorContext): string {
  return Array.from({ length: count }, () => noun(prng, ctx)).join(" ");
}
```

Picks `count` nouns and joins them. No inflection slot — singular base forms
throughout. **No gap to address** (this is lorem-ipsum-style filler, not
grammatical output).

### §1.7 Synthesis table

| Consumer                           | Inflection win  | Notes                                                                       |
| ---------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `word.ts` `sentence()`             | **High**        | Verb 3ps/past/gerund; noun plural; nl adjective `-e` agreement              |
| `word.ts` `adverb()` (en only)     | **Very high**   | `adjectives` (3 000) → derived adverbs ~3 000; zero new data                |
| `company.ts` `buzzPhrase()`        | **Medium**      | Verb form variety (bare vs gerund vs 3ps); applies to both locales          |
| `commerce.ts` `productName()` (nl) | **Medium-high** | Replaces a known-buggy hardcoded `+"en"` with proper plural/agreement rules |
| `commerce.ts` `productName()` (en) | Low-medium      | Optional plural noun                                                        |
| `person.ts` `bio()`                | Low             | Templates already hand-inflect                                              |
| `word.ts` `words()`                | None            | Lorem filler; no grammar                                                    |

---

## §2. Per-locale rule + irregular-list footprint

### §2.1 English

#### Rules (closed-form, all suffixed `(lemma: string): string`)

| Rule                | Cases handled                                                                                                                           | LOC est. | Source                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `verbPresent3ps`    | `-y → -ies` after consonant (`carry → carries`); `-o/-ss/-sh/-ch/-x/-z → -es` (`go → goes`); `-e → -es` (`like → likes`); else `+s`     | ~20      | English Grammar in Use (Murphy), Cambridge                                    |
| `verbGerund`        | drop silent `e` (`make → making`); double final consonant CVC (`run → running`); `-ie → -ying` (`die → dying`); else `+ing`             | ~25      | Same                                                                          |
| `verbPast`          | regular `+ed` with same CVC doubling + `-y → -ied` + `-e → -d`; irregular table lookup short-circuits                                   | ~25      | Wiktionary "English irregular verbs"                                          |
| `nounPlural`        | `-y → -ies` after consonant; `-fe → -ves` (`knife → knives`); `-f → -ves` (`leaf → leaves`); `-o → -oes` after consonant; else `+s/+es` | ~25      | "A Comprehensive Grammar of the English Language" (Quirk et al.) / Wiktionary |
| `adjectiveToAdverb` | `-le → -ly` (`simple → simply`); `-y → -ily` (`easy → easily`); `-ic → -ically`; irregulars (`good → well`); else `+ly`                 | ~20      | English Grammar in Use                                                        |

**Total English rules: ~115 LOC** (typed, with JSDoc).

#### Irregular lists (en)

| List                       | Approx. entries | Source                                                                                                                                                  |
| -------------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IRREGULAR_VERB_PAST`      |            ~180 | Wiktionary "English irregular verbs"                                                                                                                    |
| `IRREGULAR_VERB_PAST_PART` |            ~180 | Same (often the same entry; pair as `{past, pp}`)                                                                                                       |
| `IRREGULAR_PLURAL`         |             ~50 | Quirk et al.; common irregular plurals                                                                                                                  |
| `IRREGULAR_ADVERB`         |             ~10 | `good → well`, `fast → fast`, `hard → hard`, `late → late`, `early → early`, `daily → daily`, `friendly → in a friendly manner` (skip with `null`), ... |
| `UNCHANGED_PLURAL`         |             ~20 | `sheep`, `deer`, `fish`, `aircraft`, ...                                                                                                                |

**Total English irregular entries: ~440** ⇒ **~3 KB of TypeScript** (record
syntax with avg ~12-char keys and 10-char values plus brackets/colons/quotes).

### §2.2 Dutch

Dutch inflection is morphologically richer than English. The rule set is
~2× the size; the irregular lists are smaller but more critical (sterke
werkwoorden are a closed class but very high-frequency).

#### Rules (nl)

| Rule                   | Cases handled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | LOC est. |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: |
| `verbStem(infinitive)` | Strip `-en` suffix; handle `-iën` (`harmoniëren → harmonie`); preserve `ie` (`schrijven` → `schrijf`); reverse-vowel-shortening on closed syllables (`maken → maak`, `lopen → loop`, `schrijven → schrijf`); de-double final consonants where stem-final geminate isn't allowed (`zitten → zit`, `lekken → lek`)                                                                                                                                                                                                                                            |      ~40 |
| `verbPresent3ps`       | `stem + "t"`, unless stem already ends in `t`/`d` (then unchanged)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |      ~10 |
| `verbPresent1ps`       | `stem` as-is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |       ~3 |
| `verbPast`             | Regular: `'t kofschip` consonant test on stem-final (`f/t/k/ch/s/sj/p`) → `+te(n)`; otherwise `+de(n)`. Irregular: lookup in sterke-werkwoorden table.                                                                                                                                                                                                                                                                                                                                                                                                      |      ~25 |
| `verbPastParticiple`   | `ge-` prefix unless stem starts with unstressed prefix (`be-`, `ge-`, `ver-`, `ont-`, `er-`, `her-`, `mis-`); `'t kofschip` decides `-d` vs `-t`. Irregular sterke werkwoorden: lookup → `ge…en` form (`schrijven → geschreven`).                                                                                                                                                                                                                                                                                                                           |      ~35 |
| `nounPlural`           | `+en` is the default; `+s` after unstressed `-el`/`-er`/`-en`/`-em`/`-aar`/`-ier`/`-eur` and loanwords (heuristic: ends in `-a`/`-i`/`-o`/`-u`/`-y`); `+eren` for ~30 irregulars (`kind`, `ei`, `blad`, `lied`, ...); vowel-doubling on open syllables (`man → mannen`, `pad → paden` — orthographic consonant doubling, the inverse of the verbStem rule); e-dropping for `-ie` (`industrie → industrieën` adds diaeresis); long-vowel single → double (`baas → bazen`); voiced/voiceless final consonant alternation (`huis → huizen`, `paard → paarden`) |      ~60 |
| `adjectiveAgreement`   | Add `-e` unless the noun is **indefinite & het-word** (`een mooi huis` vs `het mooie huis`) — needs gender of the noun. With unstressed-vowel adjectives (`oranje`, `roze`, `lila`, foreign loanwords) → no `-e`. Most adjectives ending in `-en` → no `-e` (`open`, `gouden`). Predicate use → no `-e` (out of scope; sentence() always uses attributive position).                                                                                                                                                                                        |      ~40 |
| `tKofschipTest(stem)`  | Pure helper. Returns `true` if stem-final consonant ∈ `{t, k, f, s, ch, sj, p}` (and stress-final). The `'t kofschip` mnemonic.                                                                                                                                                                                                                                                                                                                                                                                                                             |      ~12 |

**Total Dutch rules: ~225 LOC.**

#### Irregular lists (nl)

| List                                             | Approx. entries | Source                                                                               |
| ------------------------------------------------ | --------------: | ------------------------------------------------------------------------------------ |
| `STERKE_WERKWOORDEN` (`{infin, vt, vd}`)         |            ~150 | Algemene Nederlandse Spraakkunst (ANS) lijst van sterke en onregelmatige werkwoorden |
| `ONREGELMATIGE_MEERVOUDEN`                       |             ~30 | `kind→kinderen`, `ei→eieren`, `lid→leden`, `stad→steden`, ...                        |
| `ADJECTIEVEN_ZONDER_AGREEMENT` (oranje/roze/...) |             ~25 | ANS                                                                                  |
| `HET_WOORDEN` (de/het classification for nouns)  |       **HEAVY** | The corpus-wide problem — see §10 Q-3                                                |

**Total Dutch irregular entries (excluding `HET_WOORDEN`): ~205** ⇒ **~5 KB
TypeScript**.

The `HET_WOORDEN` axis is the blocking question of §2 (open question Q-3, §10):
adjective `-e` agreement depends on whether the noun is a `de`-word or `het`-word.
There are ~25 000 het-words in Dutch (vs ~80 000 de-words). Three options:

1. **Ship a `het`-words map** with the locale-nl package — would need ~25 000
   entries; ~150 KB raw, ~40–50 KB OTW even with frontcoding. Breaks the B50
   "list-size is the dominant cost" budget for locale-nl.
2. **Ship a `de`/`het` flag on the noun list** — augment `nouns` from
   `readonly string[]` to `readonly Array<{ word: string; gender: "de" | "het" }>`.
   Doubles the noun bytes; breaks B50's `string[]` baseline. Requires re-sourcing
   from a gender-tagged source (OpenTaal does ship gender info in its lemma
   database, separate from `wordlist`).
3. **Default to `de`-agreement** (always emit `-e`) — wrong ~30% of the time
   in attributive position with indefinite het-words. Cheap; not great.

Recommendation: **Option 2** (`{word, gender}` for nl `nouns` only) — it
keeps the rule honest and the data layer change is contained. See §10 Q-3.

### §2.3 Footprint summary

| Locale | Rule LOC |                         Irregular entries |                                         New raw bytes (est.) |
| ------ | -------: | ----------------------------------------: | -----------------------------------------------------------: |
| en     |     ~115 |                                      ~440 |                                                        ~3 KB |
| nl     |     ~225 | ~205 (+ het-tag axis if Option 2 in §2.2) | ~5 KB rules + ~40 KB if het-tagging the noun list (Option 2) |

Compared to the B51 §1.10 OTW-cost numbers (locale-en grows ~10 KB OTW under
§1 targets; locale-nl ~10 KB OTW), the inflection rule footprint is **dwarfed**
by the size-targets work. Bundle-cost is not a blocker for B58.

---

## §3. Pipeline placement

### §3.1 Where the rules live

Inflection rules are **pure JS string transforms**. They have two natural homes:

- **Option A: `@zod4-mock/locale-core`** — export rule helpers
  (`pluralizeEn`, `gerundEn`, `'tKofschip`, `pluralizeNl`, …) from the shared
  package so each `LocaleData.formatXxx` callback can import them. **Recommended**:
  the locale-core package already exports the `Prng` interface used in callbacks;
  adding pure-string helpers there is mechanically clean.
- **Option B: per-locale package** (`@zod4-mock/locale-en/inflect`,
  `@zod4-mock/locale-nl/inflect`). Cleaner separation of locales but forces
  consumers of `locale-en` to re-implement if they want `pluralizeEn` standalone.

Recommendation: **Option A** (locale-core), with the rules namespaced
(`inflect.en.verbPresent3ps`, `inflect.nl.verbStem`). Reasoning: existing
locale callbacks already live in the locale package's `locale.ts`; they import
from `@zod4-mock/locale-core` for the `Prng` and `LastNamePrefix` types; adding
inflection imports to the same site is mechanically simplest.

### §3.2 Where the rules are called

Three call-site categories:

1. **In `src/generators/data/word.ts`** — `sentence()` and `adverb()` get
   inflected forms inline. **Touches:** `word.ts` lines 96–98 (`adverb`) and
   122–152 (`sentence`). The `sentence()` PCFG remains 5 templates (B48-R8
   preserved); only the leaf `vrb()` / `n()` / `adj()` closures change to apply
   inflection before returning.
2. **In locale callbacks** — `formatBuzzPhrase` (both locales), `formatProductName`
   (both locales). These callbacks live in `packages/locale-{en,nl}/src/locale.ts`
   and import inflection rules from locale-core. Each callback decides
   per-template-slot whether to inflect (e.g. nl `formatProductName` calls
   `pluralizeNl(material)` instead of the hardcoded `+"en"`).
3. **In `src/generators/data/word.ts` `adverb()`** — fork: if
   `loc.adjectives.length > 0` and a feature flag / always (recommendation TBD,
   see §10 Q-1), draw from `adjectives` and apply `adjectiveToAdverb`; else fall
   back to `loc.adverbs`.

### §3.3 What stays unchanged

- The **canonical `PIPELINE`** in `src/pipeline.ts` (D11). Inflection is downstream
  of the per-field pipeline — it lives inside the data generator that the
  key-map / `withGenerators` rung delegates to.
- The **`PIPELINE_NO_REGISTRATION`** subset used by `z.object` introspection.
- The **`generateArray`** trailing pass (D14). Inflection is per-element, inside
  the element generator; the trailing pass runs above.
- The **`Prng` interface** (`packages/locale-core/src/types.ts:8-18`). No new
  PRNG methods needed; inflection consumes zero PRNG.
- The **`LocaleData` shape's existing fields**. Recommendation in §6: **add**
  optional fields (`verbLemmas`), don't change existing ones.

---

## §4. Determinism / isomorphism

### §4.1 Determinism (D4 / D10)

Every inflection-using call site preserves today's PRNG budget:

| Call site                | Today's draws                     | After inflection                                     |
| ------------------------ | --------------------------------- | ---------------------------------------------------- |
| `sentence()` `vrb()`     | 1 `prng.random()` (via `locPick`) | 1 `prng.random()` — pick `verbLemma`, transform pure |
| `sentence()` `n()`       | 1 `prng.random()` + cap()         | 1 `prng.random()` — pick noun, pluralise pure        |
| `adverb()`               | 1 `prng.random()`                 | 1 `prng.random()` over `adjectives`; transform pure  |
| `buzzPhrase()` verb      | 1 `prng.random()`                 | 1 `prng.random()`; transform pure                    |
| `productName()` material | 1 `prng.random()`                 | 1 `prng.random()`; `pluralizeNl` pure                |

**The transform consumes zero PRNG state.** Per-field PRNG `fork` upstream
(`prng.fork(fieldName)`) is unchanged. Schema-reference identity (D10) is
unchanged. Adding/removing inflection rules does not perturb seed→value mapping
for **other** fields.

**Seed-shift risk:** flipping from `loc.verbs` (8 surface entries) to
`loc.verbLemmas` (say 50 entries) does **shift** the seed→value mapping for the
verb slot itself — the population the `prng.random()` indexes into changes.
This is a **behavior change** (the SemVer note in §8 Q-7) but not a determinism
violation: still one draw, still closed-form, still pure.

A subtle case: if the inflection rule **optionally chooses between forms**
(e.g. `buzzPhrase` 50/50 between bare and gerund), that flip consumes one
**additional** PRNG draw and shifts the per-record budget. **Recommendation
(see §10 Q-2):** the form choice should be a **deterministic per-call-site
decision** baked into the rule (e.g. `buzzPhrase` always emits gerund), not a
PRNG-driven mode flip — that keeps the budget byte-identical and the SemVer
shift narrowly to the lemma-vs-surface population change.

### §4.2 Isomorphism (D13)

The rule library uses only:

- String primitives: `.endsWith()`, `.startsWith()`, `.slice()`, `.charAt()`,
  `.charCodeAt()`, `.toLowerCase()`, `.toUpperCase()`, template literals.
- Plain `Record<string, string>` (or `Map<string, string>`) lookup for irregulars.
- Constant arrays of vowels / consonants / suffix sets.

**Explicitly NOT used (D13 hits to avoid):**

- `Intl.Collator`, `Intl.Segmenter`, `Intl.PluralRules` — diverge between Node
  versions and browsers; not isomorphic. (`Intl.PluralRules` does English plurals
  but only returns category names like `"one"`/`"other"`, not the inflected
  form — wouldn't help anyway.)
- `String.prototype.normalize("NFC")` — present in all modern runtimes but
  unnecessary for the en/nl rule set; the lemma corpora are already NFC.
- `node:string_decoder`, `node:util`, `Buffer.from`, `zlib.brotliCompressSync`
  — all banned by D13.
- `new RegExp(string)` — not banned per se, but the rule set is **literal-regex
  only** (`/[aeiou]/`), no constructor-from-data.

The result is byte-identical between Node 18+/20+/22+, Chromium/Firefox/Safari,
Cloudflare Workers, Vercel Edge, and MSW shims — same as the B48 baseline.

### §4.3 No `any` (D1)

All proposed rule signatures: `(lemma: string) => string` and irregular
maps `Readonly<Record<string, string>>` / `ReadonlyMap<string, string>`. No
`any`; no `unknown` requiring narrowing inside hot loops.

---

## §5. Composition with prior decisions

### §5.1 With B51 (Zipf-default size targets)

Composition is **clean and additive**:

1. **B51 picks the lemma** (`prng.pickZipf(verbLemmas, s)` instead of
   `prng.pick(verbs)`).
2. **B58 inflects the picked lemma** (`verbPresent3ps(picked)`,
   `verbPast(picked)`, …).

The two transforms are sequential and orthogonal. Zipf-default consumes one
`prng.random()` (the inverse-CDF draw); inflection consumes **zero**. Total
PRNG budget per call: **1 draw** (same as today).

**Specific interactions:**

- B51 §1.5 sets target sizes `verbs ~50 / adverbs ~30`. B58 makes the per-target
  number **less important** for `adverbs` (en): if the adverb pool is derived
  from `adjectives` (3 000), then `loc.adverbs` becomes a small reserved-words
  list (~10 entries: `here`, `now`, `then`, `there`, `often`, `always`,
  `never`, `sometimes`, …) instead of a sized open list.
- B51 §1.4 sets `buzzVerbLemmas: 60` for both locales. B58 makes that number
  hit harder per byte — 60 lemmas × 2–3 inflected forms each = 120–180 effective
  surface forms across the buzz-phrase corpus.
- B51 Q-4 (nouns/adjectives re-sourcing from SUBTLEX): unaffected by B58.
- B51 Q-5 (cities expansion): unaffected.
- B51 §7 (uniqueness / collision): inflection **increases** the effective
  variety, which **decreases** the collision rate for unique-context draws. Net
  positive for B8 / `world.get`.

### §5.2 With B55 (sibling realism axis)

B55 isn't a live card I read; B51 references it as a sibling. Inflection
is independent.

### §5.3 With B54 / B57 (numeric distributions)

B54 (Benford) and B57 (related sibling) operate on numeric values. **No
interaction.**

### §5.4 With B48 (real wordlists)

B48 shipped `readonly string[]` as the wire format. Inflection is a
**consumer-side transform** that does not touch the data shape. Recommendation
in §6 to **add** optional `verbLemmas` keeps the existing fields untouched and
makes B58 strictly additive.

### §5.5 With D14 (`generateArray` trailing pass)

The trailing pass (cap → overrides → transform) runs **above** the per-element
generator. Inflection is per-element. The two passes do not interact.

### §5.6 With B23 / D11 (`PIPELINE`)

Inflection lives inside the data generator that the `PIPELINE`'s key-map /
`withGenerators` rung delegates to. The pipeline is **structurally unchanged**.

---

## §6. Lemma-list vs surface-list shape on `LocaleData`

### §6.1 Recommendation: keep surface lists, **add** opt-in lemma fields

Adding inflection should not break existing `LocaleData` consumers. Three
shape options were considered:

**Option A (recommended): additive — keep surface fields, add optional
`*Lemmas` fields where useful.**

```ts
// addition to LocaleData.word in packages/locale-core/src/types.ts
word: {
  // ... existing fields ...
  /**
   * Optional infinitive verb lemmas. When present, generators that
   * support inflection (e.g. `sentence()`) MAY pick from this list and
   * apply the locale's inflection rules to produce 3ps / past / gerund
   * forms. When absent, generators fall back to the surface-form `verbs`
   * and `verbsPlural` fields.
   */
  verbLemmas?: readonly string[];
}
```

`buzzVerbLemmas` already exists on `LocaleData.company` (B51 §1.4 confirmed at
`packages/locale-core/src/types.ts:105`) — `verbLemmas` follows the same
naming convention. No other new field strictly required.

**Pros:** zero-break for existing custom locales (via `extend()`); the
inflection feature is opt-in per locale; generators can detect presence and
choose. **Cons:** two arrays per concept (lemmas vs surface forms) — slight
data duplication if a maintainer ships both. Mitigated by the fact that
**lemma-only** is enough for B58: surface-form `verbs` / `verbsPlural` can be
deprecated in a follow-up minor bump once all generators are inflection-aware.

**Option B (rejected): repurpose existing fields as lemmas.** Rename `verbs`
to `verbLemmas` and require generators to inflect. Breaking change to
`LocaleData`; forces every custom locale to update at once; loses the
"surface-form fallback" escape hatch.

**Option C (rejected): tagged-union entries.** Make `verbs` be
`Array<{ lemma: string; surface?: string }>`. More expressive but doubles the
field's bytes and is more cumbersome for the common case where the lemma's
surface form is itself a valid value (e.g. `streamline` → bare-form `streamline`).

### §6.2 Other lemma-vs-surface considerations

Per B51's existing classification:

- `company.buzzVerbLemmas` — already lemmas (en 18, nl 19). No change.
- `word.verbs` — surface (3ps present). Recommendation: **add** `word.verbLemmas`.
- `word.verbsPlural` — surface (base form / infinitive). Becomes derivable from
  `verbLemmas` under inflection. In the back-compat scenario, generators that
  inflect read `verbLemmas`; generators that don't (custom matchers) keep using
  `verbsPlural`.
- `word.adjectives` — already lemmas (positive base). No change.
- `word.nouns` — singular base = lemma. No change.
  - **Exception for nl:** for adjective `-e` agreement, the nouns need
    `de`/`het` gender. See §2.2 Option 2: change `nl.word.nouns` to
    `readonly Array<{ word: string; gender: "de" | "het" }>` and update
    `noun()` to extract `.word`. Source-of-truth blocking question in §10 Q-3.
- `word.adverbs` — surface. Recommendation: keep as a small closed list of
  non-adjective-derived adverbs (`here`, `now`, …); the productive adverb pool
  is derived from `adjectives`.

### §6.3 What does NOT change on `LocaleData`

- `Prng` interface unchanged.
- All address / commerce / company / finance / date / color / phone subtrees
  unchanged (no inflection consumers there).
- All format callbacks (`formatBio`, `formatFullName`, `formatPrice`, …)
  unchanged in shape — only their implementations may evolve (e.g.
  `formatProductName` in nl drops the hardcoded `+"en"` in favour of
  `pluralizeNl(material)`).

---

## §7. Faker comparison

`@faker-js/faker` (read from API docs, not refetched):

| Generator                | Faker shape                                                | Inflection? |
| ------------------------ | ---------------------------------------------------------- | ----------- |
| `lorem.words(N)`         | Joins N uniform draws from a flat noun/word list           | None        |
| `lorem.sentence()`       | Templated; picks from flat lists, capitalises, appends `.` | None        |
| `word.verb()`            | Uniform pick from a flat list of surface forms             | None        |
| `word.adverb()`          | Flat list                                                  | None        |
| `word.adjective()`       | Flat list of positive-degree adjectives                    | None        |
| `commerce.productName()` | `<adjective> <material> <noun>` template, faker-en         | None        |
| `company.catchPhrase()`  | `<adjective> <descriptor> <noun>` template                 | None        |
| `company.buzzPhrase()`   | `<verb> <adjective> <noun>` template; bare verb            | None        |

Faker ships **inflection-free, uniform-pick** corpora. The verb list in
`@faker-js/faker/locale/en` is a small (~30) list of surface forms; no
gerund/past forms; no productive rule.

This is the same shape as `zod4-mock` pre-B58. Adopting inflection-at-gen-time
is a **deliberate realism divergence**, on the same axis as:

- B51's Zipf-default for picks (faker is uniform).
- B54's Benford-default for numerics (faker is uniform-in-range).

The "documented divergence" pattern is established (per B51 §6). Document in
`docs/concepts.md` alongside the other two: a "Realistic generation" section
that explains zod4-mock chooses semantically-rich defaults over faker-parity.
No `faker` dependency. No external fetches.

---

## §8. Implementation hand-off summary

Proposed implementation card id: **B58** — "Inflection transforms in locale
generators". Recommendation: **split into two cards** so the Dutch rule set
can be reviewed in isolation.

### §8.1 Card split

**Card B58-A — English inflection** (full track):

- Touches `packages/locale-core/src/inflect/en.ts` (new), exporting
  `verbPresent3ps`, `verbGerund`, `verbPast`, `nounPlural`, `adjectiveToAdverb`,
  and the four irregular-list constants.
- Touches `packages/locale-core/src/index.ts` (export the `inflect.en` namespace).
- Touches `packages/locale-core/src/types.ts` — add optional `verbLemmas?:
readonly string[]` to `LocaleData.word`.
- Touches `packages/locale-en/src/data/verb-lemmas.ts` (new) — ~50–60 base-form
  verb lemmas, freq-ordered (per B51 §1.5 target ~50).
- Touches `packages/locale-en/src/locale.ts` — wire `verbLemmas` into the
  exported `en: LocaleData`.
- Touches `packages/locale-en/src/locale.ts` `formatBuzzPhrase` — inflect verb
  to gerund (deterministic, no PRNG flip per §4.1).
- Touches `src/generators/data/word.ts` `sentence()` — when `loc.verbLemmas`
  is present, pick from it and apply per-slot inflection; else fall back to
  `loc.verbs` / `loc.verbsPlural`. Apply `nounPlural` to a coin-flip of `n()`
  calls per template — but **deterministic** by call-site index, not by extra
  PRNG draw (per §4.1).
- Touches `src/generators/data/word.ts` `adverb()` — when `loc.adjectives.length
  > 0`, pick adjective and derive adverb; else fall back to `loc.adverbs`.
- Touches `docs/api-reference.md` — `LocaleData.word.verbLemmas` documented;
  inflection behavior noted.
- Touches `docs/concepts.md` — short "Inflection" section pointing at the
  realism axis; faker divergence note.
- Tests: regression in `tests/unit/generators/data/word.spec.ts` (or wherever
  `sentence()` is unit-tested) asserting that with a known seed and a known
  lemma list, the verb slot emits the expected inflected form. Snapshot churn
  in `tests/integration/` expected — one-time re-pin.

**Proposed R-IDs for the spec-writer:**

- **B58-A-R1**: `LocaleData.word.verbLemmas?: readonly string[]` MUST exist;
  absent means generators fall back to existing surface fields.
- **B58-A-R2**: `inflect.en.verbPresent3ps(lemma)` MUST be deterministic and
  consume zero PRNG state.
- **B58-A-R3**: `inflect.en.verbPresent3ps("go")` MUST return `"goes"` (irregular
  table); `inflect.en.verbPresent3ps("walk")` MUST return `"walks"` (regular).
  One test per rule per regular/irregular category — minimal coverage.
- **B58-A-R4**: `inflect.en.nounPlural("box")` MUST return `"boxes"`;
  `inflect.en.nounPlural("city")` MUST return `"cities"`;
  `inflect.en.nounPlural("sheep")` MUST return `"sheep"` (unchanged-plural list).
- **B58-A-R5**: `inflect.en.adjectiveToAdverb("simple")` MUST return `"simply"`;
  `("easy") → "easily"`; `("good") → "well"`.
- **B58-A-R6**: `sentence(prng, { locale: en })` MUST emit verbs from
  `verbLemmas` inflected to 3ps in template slots that today emit `loc.verbs`
  (regression test: with a fixed seed, the verb slot value matches the
  inflected form, not the bare lemma).
- **B58-A-R7**: `adverb(prng, { locale: en })` MUST emit adverbs derived from
  `adjectives` when `adjectives.length > 0` (regression: known seed → known
  derived adverb).
- **B58-A-R8**: PRNG budget for `sentence()` and `adverb()` MUST be byte-identical
  to today's budget shape (one draw per leaf slot). Determinism regression test.
- **B58-A-R9**: All inflection rules MUST be pure JS (no `node:*`, no
  `Buffer`, no `Intl`-locale dependence). Isomorphism regression — a smoke
  import test under MSW-style environment.
- **B58-A-R10**: `docs/api-reference.md` and `docs/concepts.md` updated.
- **B58-A-R11**: changeset entry (minor bump per B48 precedent).

**Card B58-B — Dutch inflection** (full track, separate card for review
isolation):

- Touches `packages/locale-core/src/inflect/nl.ts` (new) — verb rules,
  `'t kofschip`, plural, adjective agreement, `STERKE_WERKWOORDEN` list,
  `ONREGELMATIGE_MEERVOUDEN`, `ADJECTIEVEN_ZONDER_AGREEMENT`.
- Touches `packages/locale-nl/src/data/verb-lemmas.ts` (new) — ~50 verb
  infinitives.
- Touches `packages/locale-nl/src/data/nouns.ts` — **resolution of §10 Q-3 first**.
  If Option 2 (gender tag): regenerate `nouns.ts` as `Array<{word, gender}>`;
  bump `LocaleData` shape (`word.nouns` becomes union or new
  `nounsWithGender?`). If Option 1 (het-words map): ship the map.
  If Option 3 (default-de): no data change, document the rate.
- Touches `packages/locale-nl/src/locale.ts` — `formatProductName` replaces
  hardcoded `+"en"` with `pluralizeNl(material)`; `formatBuzzPhrase` inflects
  verb to 3ps.
- Touches `src/generators/data/word.ts` `sentence()` — Dutch path of the same
  verb / noun / adjective inflection.
- Tests: per-rule regression (similar shape to B58-A-R3..R5), plus
  `'t kofschip` regression (`werken → werkte` / `wandelen → wandelde`).
- Documentation + changeset.

**Proposed R-IDs**: parallel to B58-A but per nl rule. Plus:

- **B58-B-R1**: `'t kofschip` test MUST classify `werk`/`klop`/`fits`/... as `te`
  (one regression test per consonant in the mnemonic).
- **B58-B-R2**: adjective `-e` agreement MUST emit `mooie` before de-words and
  before definite het-words (`het mooie huis`), and MUST emit `mooi` before
  indefinite het-words (`een mooi huis`). Requires Q-3 resolved (gender source).

### §8.2 Lite vs full

B58-A is **borderline lite** (touches ~5 files, no API break, but behavior
changes for `sentence()` and `adverb()`). Recommend **full track**:
implementer is straightforward, but observable output changes warrant a
test-writer pass to fix the per-rule regressions before implementer touches
the leaf generators. Reviewer must check the snapshot re-pin and the
isomorphism smoke.

B58-B is unambiguously **full** — `'t kofschip` and adjective agreement have
nuanced edge cases that benefit from per-rule tests landed before the
implementation.

### §8.3 Commit shape

- B58-A: one commit (per item, per Vibin rule). Likely ~600–800 LOC including
  irregular tables and tests. Changeset minor.
- B58-B: one commit. Likely ~1 000 LOC + the resolved Q-3 data axis. Changeset
  minor.

---

## §9. No new standing constraint

The mechanism fits cleanly under the existing Rules:

- **D4 / D10:** Each leaf inflection call consumes one `prng.random()` draw
  (the pick) plus a pure transform. No change in determinism contract.
- **D11:** Inflection is downstream of the `PIPELINE` (inside the data
  generator that the key-map / `withGenerators` rung delegates to).
- **D13:** Pure JS; explicitly no `node:*`, no `Buffer`, no `Intl`-locale
  dependence (D13 already covers it).
- **D14:** Inflection is per-element; the array trailing pass runs above and
  doesn't see the per-element transform.

Considered phrasings of a new rule and rejected:

- **"Inflection rules MUST be deterministic and consume zero PRNG state."** —
  Already covered by D4 + D13. A rule restating it would be redundant.
- **"Locale callbacks MUST inflect via `@zod4-mock/locale-core` helpers, not
  ad-hoc string concatenation."** — Style preference, not a binding constraint
  for future work. The reviewer can flag ad-hoc inflection during code review
  without needing a D-number.

**Recommendation: no new D-number, no new RFC-2119 line in
`wiki/architecture.md`.**

---

## §10. Open questions

### §10.1 Blocking

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                     | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-1 | **English `adverb()` — derive from adjectives unconditionally, or behind a flag?** Today `adverb()` reads `loc.adverbs` (8 entries). Inflection lets it read `loc.adjectives` (3 000) and apply `adjectiveToAdverb`. Should this be unconditional (`adverb()` always derives from `adjectives` if `adjectives.length > 0`), or gated by a setting (`loc.deriveAdverbs?: boolean`)? Behavior change is large (~375× variety). | **Unconditional, with `loc.adverbs` retained for non-derivable adverbs.** Pre-v1 is the moment to default to realism (B51 §6 same framing). Mitigation: the 8 reserved-words list (`here`, `now`, `then`, …) stays in `loc.adverbs`; `adverb()` rolls 50/50 between "pick from reserved closed list" and "derive from `adjectives`" via the same deterministic per-call-site bake (no extra PRNG draw — see Q-2). Custom locales that don't want derivation can set `loc.adjectives = []`.                                        |
| Q-2 | **Form-choice strategy: deterministic per call site vs PRNG-driven flip?** For consumers with multiple valid forms (`buzzPhrase` bare vs gerund; `sentence` slot-1 verb 3ps vs past), should the rule **always emit a fixed form** (deterministic, zero extra PRNG) or **roll between forms** (one extra `prng.random()` per inflection-site)?                                                                               | **Always fixed per call site.** Eliminates the PRNG-budget shift (so D4/D10 is byte-identical for the seed→value mapping aside from the lemma-population change). Variety still increases because each call site emits a different form (sentence template 1 always emits 3ps; template 2 always emits past; etc.). Keeps the SemVer shift narrow.                                                                                                                                                                                |
| Q-3 | **Dutch noun gender source (`de` vs `het`).** Adjective `-e` agreement and article selection require knowing each noun's gender. Three options (§2.2): ship a `het`-words map (~25 000 entries, ~50 KB OTW); augment nl `nouns` from `string[]` to `Array<{word, gender}>` (~5 KB OTW; breaks B50 baseline shape for nl); default to `de`-agreement (always emit `-e`; wrong ~30% of the time in indefinite-het context).    | **Option 2 (gender tag on `nl.nouns`).** OpenTaal ships a separate genus-tagged lemma database; refetching `nouns.ts` from that source instead of `wordlist.txt` is a one-script change (similar to B51's freq-sort retrofit). Cost: ~5 KB OTW for nl. Benefit: adjective rule is honest. Default-de (Option 3) is the fallback if license blocks the gendered source; ship `frequencyExponent`-style audit note. NOT Option 1 — 50 KB blows past the B50 budget. **This question gates B58-B specifically; B58-A is unblocked.** |

### §10.2 Non-blocking (recommendations baked in)

| #   | Question                                                                                                                                                                                          | Recommendation                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-4 | **Source of `verbLemmas` for en/nl.** B51 §1.5 targets ~50 verbs/locale. Existing lists are surface forms. Where do lemmas come from?                                                             | en: top-50 most-common English verbs (corpora-cited reference lists are public domain; the implementation card pins which one). nl: ANS basislijst van veelvoorkomende werkwoorden, ~50 entries (open licence).                                                                                                      |
| Q-5 | **`verbsPlural` field: deprecate, remove, or keep?** B58 makes the lemma-driven generator skip `verbsPlural` entirely (it derives plural agreement from the lemma).                               | **Keep, mark as deprecated.** Custom locales may still depend on it; removing breaks `extend()`-using user code. Add a JSDoc `@deprecated since vNEXT — use verbLemmas + inflection`. Remove in a future major.                                                                                                      |
| Q-6 | **Should the inflection rules be exported from `@zod4-mock/locale-core` as a user-facing API?** Custom-matcher authors may want `inflect.en.nounPlural` to inflect their own data.                | **Yes** — export under `@zod4-mock/locale-core` as `inflect.en.*` / `inflect.nl.*`. Document in `docs/api-reference.md` under the locale-core package. Stable from day one; no `internal/` prefix.                                                                                                                   |
| Q-7 | **SemVer.** B58 changes seed→value mappings for verb / adverb / sentence / buzzPhrase / productName slots. Behavior change, not API break.                                                        | **Minor bump** (per B48 / B39 / B51 precedent for behavior-changing realism shifts on 0.x). Document in `CHANGELOG.md` under "Behavior changes".                                                                                                                                                                     |
| Q-8 | **Snapshot test re-pin.** Same as B51: integration test snapshots will shift on the verb / adverb / sentence slots.                                                                               | **Test-writer re-pin in the same commit**, audited by reviewer. Per B48 precedent.                                                                                                                                                                                                                                   |
| Q-9 | **Future locales beyond en/nl.** The inflection scaffolding will be a per-locale module (`inflect.en.ts`, `inflect.nl.ts`). Should the locale-core package mandate that every locale provide one? | **No — inflection is opt-in per locale.** A locale with no `verbLemmas` field on its `LocaleData.word` simply doesn't get the inflection win. Generators always fall back to surface fields. Documented in `docs/api-reference.md` as "Inflection is optional; locales that ship `verbLemmas` get inflected output". |

---

## §11. Tooling disclosure

For honesty:

- **One Bash `grep` slip** on `/home/dexter/Projects/typescript/zod4-mock/src/generators/data/key-map.ts` —
  used `grep -nE "verb|noun|..."` to confirm which keys route to which data
  generator. I should have used the `Grep` tool. Caught after-the-fact.
- **One Bash `ls` slip** to enumerate `packages/locale-{en,nl}/src/`, and one
  more on `wiki/research/text-generation/` to confirm the page existed before
  rewriting. Should have used `Glob` instead.
- **Two Bash `find` slips** to look for any `packages/*/generators/` directory
  (it doesn't exist) and to confirm the `key-map.ts` path. Should have used
  `Glob` instead.
- No `node -e`, `python -c`, or ad-hoc scripts were run.
- No external `fetch` calls were issued. All linguistic numbers
  (irregular-verb counts, `'t kofschip` rule, het-words count) come from
  knowledge of published grammar references (Murphy, Quirk et al., ANS); no
  re-fetching for this report.
- Total Bash slips: **4** (one `grep`, two `ls`-equivalents, two `find`).

---

## See also

- [B3 backlog card](../../backlog/doing/B3-conjugation-compression.md)
- [B51 — locale list size targets + Zipf-default picks](locale-list-size-targets.md)
- [B48 — replace Markov with real wordlists](../../backlog/done/B48-replace-markov-with-real-wordlists.md)
- [B50 — isomorphic corpus encoding null-result](isomorphic-corpus-encoding.md)
- [B54 — realistic numeric distributions](../../backlog/done/B54-realistic-numeric-distributions.md)
- [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts)
- [`src/generators/data/word.ts`](../../../src/generators/data/word.ts)
- [`src/generators/data/company.ts`](../../../src/generators/data/company.ts)
- [`src/generators/data/commerce.ts`](../../../src/generators/data/commerce.ts)
- [`packages/locale-en/src/locale.ts`](../../../packages/locale-en/src/locale.ts)
- [`packages/locale-nl/src/locale.ts`](../../../packages/locale-nl/src/locale.ts)
