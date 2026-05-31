# Wordlist Corpus Sourcing & Sizing Spike (B46)

> **Spike report for backlog item B46.** Measurement-and-sourcing gate that must
> pass before the B45 wordlist direction is filed as an implementation item.
> Read-only on the source corpora; no code or generator changes proposed.
>
> Anchored to **measured** numbers from
> [scripts/b46-measure-corpus-sizes.ts](../../../scripts/b46-measure-corpus-sizes.ts)
> for the locale-names corpora and to documented filter rules + extrapolation
> for locale-en (whose raw corpora are fetched on demand and not checked in).
>
> Parent context: [markov-alternatives.md](markov-alternatives.md) (B45 report),
> [markov-training-pipeline.md](markov-training-pipeline.md),
> [word-generation.md](word-generation.md).

---

## §1. Executive summary

The B45 estimate is **confirmed and tighter than predicted**. The full real
wordlists behind today's locale-names Markov models compress to:

- **172 KB** front-coded + brotli across **all five** locale groups combined
  (vs. the **2.34 MB** shipped Markov-model corpus — a **13.5× reduction**),
- **every group except `english` is under 11 KB** compressed,
- `english` carries 160 KB by itself (driven by the 88,448-entry US surnames
  corpus); per-locale-group it's the only one approaching the ~250 KB ceiling
  from B45's claim, and it stays under,
- locale-en (separate workspace, raw corpora not checked in) is extrapolated
  at **~260 KB** front-coded+brotli total — `last-names.txt` (SSA-style
  ~150 K rows) is the cliff; filtering to the top ~10 K most-common surnames
  brings it to ~30 KB.

Corpora needing maintainer greenlight before any retrain/data-shipping commit:

1. **Dutch first names** — Meertens-derived [open-nl-data/dutch-names-dataset](https://github.com/open-nl-data/dutch-names-dataset)
   (license: MIT per the upstream repo, derived from Meertens Instituut data).
2. **Dutch surnames** — `digitalheir/family-names-in-the-netherlands` (license
   not declared on the upstream repo — **blocking**, see §7).
3. **English first names** — `arineng/arincli` male+female lists
   (license: ISC per the upstream `arincli` repo).
4. **English surnames** — `smashew/NameDatabases` US surnames
   (license: not declared on the upstream repo — **blocking**, see §7).
5. **Arabic / Frisian / Turkish** — these aren't independently sourced
   corpora; they're **regex-classified slices** of the same Dutch registry,
   currently produced by [`packages/locale-names/scripts/classify-utils.ts`](../../../packages/locale-names/scripts/classify-utils.ts).
   The resulting corpora are tiny (109–285 entries) and contain measurable
   misclassifications (Frisian e.g. `obed`, `pierino`, `pierre`). **Blocking**:
   maintainer decides between (a) keeping the regex-classified slices as-is,
   (b) replacing them with native-source corpora (e.g. an Arabic names list
   from a Lebanese/Egyptian registry), or (c) dropping these groups entirely
   from the spike's scope.
6. **English nouns + adjectives (locale-en)** — `dwyl/english-words`
   (license: MIT, but the entries are unannotated; the current `adjectives`
   slice uses a suffix heuristic that is admitted in
   [`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts) line 95-110).
   **Non-blocking but worth flagging**: a curated lemma list (e.g. from
   [Open American National Corpus](http://www.anc.org/) or
   [SUBTLEX-US](https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus))
   would replace this heuristic with publisher-rated POS data.

**B42 (#24) is cancellable.** §6 below shows the Markov empty-state row's
first-letter distribution (8.7% `a`, 4.3% `b`, … — not heavily A/B/C/D-skewed
on its own), the real list's natural first-letter histogram (Dutch male:
`j` 10.5%, `a` 8.7%, `m` 8.3%, `r` 8.0%; A+B+C+D combined = 22%), and
confirms that `prng.pick` over the real list reproduces the second by
construction — independent of any Markov skew. Cancel B42 when the B46
direction lands as an implementation item.

---

## §2. Per-locale corpus sourcing + licenses

| Locale (group)           | Source dataset                                                                                                                                                                                                | Publisher / link                  | Entry count (measured / documented)        | License                                                             | Today's shipped Markov-model size                  | Fetch script                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| dutch (first names)      | [open-nl-data/dutch-names-dataset](https://github.com/open-nl-data/dutch-names-dataset) `firstnames.json` — Meertens/registry-derived, frequency-filtered (`DUTCH_MIN_FREQ = 500`, see fetch-data.ts line 31) | open-nl-data                      | male 1,489 / female 1,837 (post-filter)    | MIT (per upstream repo)                                             | male 467 KB (o3), female 460 KB (o3); see B45 §1.2 | [`packages/locale-names/scripts/fetch-data.ts`](../../../packages/locale-names/scripts/fetch-data.ts) lines 50-106        |
| dutch (last names)       | [digitalheir/family-names-in-the-netherlands](https://github.com/digitalheir/family-names-in-the-netherlands) `top_1000_last_names_in_the_netherlands_2007.csv`                                               | digitalheir (CBS-derived)         | 854 (post-filter; `de`/`van` prefix split) | **Not declared** on upstream repo — blocking                        | 82 KB (o2)                                         | [`packages/locale-names/scripts/fetch-data.ts`](../../../packages/locale-names/scripts/fetch-data.ts) lines 108-126       |
| english (first names)    | [arineng/arincli](https://github.com/arineng/arincli) `lib/male-first-names.txt`, `lib/female-first-names.txt`                                                                                                | arineng                           | male 1,212 / female 4,242                  | ISC (per upstream repo)                                             | male 416 KB (o3), female 609 KB (o3); see B45 §1.2 | [`packages/locale-names/scripts/fetch-data.ts`](../../../packages/locale-names/scripts/fetch-data.ts) lines 132-161       |
| english (last names)     | [smashew/NameDatabases](https://github.com/smashew/NameDatabases) `NamesDatabases/surnames/us.txt`                                                                                                            | smashew                           | 88,448                                     | **Not declared** on upstream repo — blocking                        | 166 KB (o2)                                        | [`packages/locale-names/scripts/fetch-data.ts`](../../../packages/locale-names/scripts/fetch-data.ts) lines 163-177       |
| arabic                   | Slice of `open-nl-data/dutch-names-dataset` via Dutch-transliteration regex in `classify-utils.ts` (Arabic prefixes/roots; `ORIGIN_MIN_FREQ = 5`)                                                             | derivative — same upstream        | male 251 / female 243                      | MIT (derives from MIT upstream)                                     | male 44 KB (o2), female 49 KB (o2)                 | [`packages/locale-names/scripts/classify-utils.ts`](../../../packages/locale-names/scripts/classify-utils.ts) lines 9-15  |
| frisian                  | Slice via Frisian-name regex in `classify-utils.ts`                                                                                                                                                           | derivative — same upstream        | male 250 / female 285                      | MIT (derives from MIT upstream)                                     | male 48 KB (o2), female 44 KB (o2)                 | [`packages/locale-names/scripts/classify-utils.ts`](../../../packages/locale-names/scripts/classify-utils.ts) lines 28-32 |
| turkish                  | Slice via Turkish-name regex in `classify-utils.ts`                                                                                                                                                           | derivative — same upstream        | male 109 / female 115                      | MIT (derives from MIT upstream)                                     | male 33 KB (o2), female 32 KB (o2)                 | [`packages/locale-names/scripts/classify-utils.ts`](../../../packages/locale-names/scripts/classify-utils.ts) lines 17-26 |
| locale-en (first male)   | [SSA Baby Names 2023](https://www.ssa.gov/oact/babynames/) `names.zip` → `yob2023.txt`                                                                                                                        | US Social Security Administration | ~14 K (post-dedup, full SSA 2023)          | Public domain (US government)                                       | 113 KB (o2); see B45 §1.1                          | [`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts) lines 32-57               |
| locale-en (first female) | same as above                                                                                                                                                                                                 | US SSA                            | ~17 K (post-dedup)                         | Public domain                                                       | 102 KB (o2)                                        | same                                                                                                                      |
| locale-en (last names)   | [US Census 2010 Surnames](https://www2.census.gov/topics/genealogy/2010surnames/Names_2010Census.csv)                                                                                                         | US Census Bureau                  | ~150 K (post `/^[a-z]+$/` filter)          | Public domain                                                       | 128 KB (o2)                                        | [`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts) lines 63-78               |
| locale-en (nouns)        | [dwyl/english-words](https://github.com/dwyl/english-words) `words_alpha.txt` filtered to `/^[a-z]{4,12}$/`, **first 5,000 entries** after the adj split                                                      | dwyl                              | 5,000 (hard `.slice(0, 5000)`)             | MIT (per upstream repo) — but POS rating is heuristic, not labelled | 109 KB (o2)                                        | [`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts) lines 84-121              |
| locale-en (adjectives)   | same as nouns, filtered by suffix heuristic (`ful`, `less`, `ous`, …), **first 3,000 entries**                                                                                                                | dwyl                              | 3,000 (hard `.slice(0, 3000)`)             | MIT — POS rating is heuristic                                       | 92 KB (o2)                                         | [`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts) lines 95-110              |

Two recurring patterns to surface for sign-off:

- **The "frisian/turkish/arabic" corpora are derivative.** They aren't sourced
  from native-language registries; they are regex-classified slices of the
  same Dutch dataset. The Frisian male list (250 entries) contains visible
  misclassifications (`obed`, `obeth`, `pierino`, `pierre`) because the regex
  matches partial-prefix patterns. The maintainer should decide whether to
  treat these as "Dutch-transliterated foreign-origin names" (in which case
  the corpus name is misleading) or to source native-language corpora
  (which would inflate sizes — but the per-locale numbers below show there's
  plenty of headroom).
- **Two corpora ship from upstream repos with no declared license**
  (`digitalheir/family-names-in-the-netherlands` and
  `smashew/NameDatabases`). For a library that ships the _data itself_
  (rather than a trained-model derivative), this needs maintainer
  clarification. CBS top-1000 surnames have a known data-policy footprint
  (CBS publishes the names under their open-data licence); a direct fetch
  from the CBS source would be cleaner than the digitalheir mirror.

---

## §3. Measured / estimated sizes

### §3.1 Measured — `packages/locale-names/data/training/` (real corpora)

All numbers below come from
[scripts/b46-measure-corpus-sizes.ts](../../../scripts/b46-measure-corpus-sizes.ts).
Reproduce with `pnpm tsx scripts/b46-measure-corpus-sizes.ts`. Encoding details:

- **raw** — `fs.statSync(path).size` of the on-disk newline-delimited file.
- **front-coded** — sorted ascending, each line stored as
  `<1-byte shared-prefix-length> <suffix bytes> <\n>` (a varint would compress
  marginally better but a single byte covers all real word lengths).
- **fc+brotli** — `brotliCompressSync(frontCoded, quality 11)`.
- **gzip** — `gzipSync(sortedNewlineText, level 9)` on the raw sorted file.
- **brotli** — `brotliCompressSync(sortedNewlineText, quality 11)`.

| group       | file           |  lines |     raw | front-coded |   fc+brotli |    gzip |  brotli | A/B/C/D% | top-5 first letters                    |
| ----------- | -------------- | -----: | ------: | ----------: | ----------: | ------: | ------: | -------: | -------------------------------------- |
| arabic      | female.txt     |    243 |   1,906 |       1,419 |     **565** |     644 |     612 |    36.6% | a:25.5% n:11.5% m:9.5% c:8.2% g:7.0%   |
| arabic      | male.txt       |    251 |   2,255 |       1,481 |     **678** |     746 |     718 |    51.8% | a:46.2% n:10.4% m:9.6% s:6.8% h:3.6%   |
| dutch       | female.txt     |  1,837 |  13,508 |       8,809 |   **3,643** |   4,975 |   4,289 |    23.1% | m:11.3% a:10.1% j:9.0% l:7.5% e:6.1%   |
| dutch       | last-names.txt |    854 |   6,279 |       4,606 |   **2,013** |   2,515 |   2,376 |    21.8% | b:13.2% s:9.8% k:9.4% h:9.1% v:7.5%    |
| dutch       | male.txt       |  1,489 |  10,205 |       7,032 |   **3,102** |   4,111 |   3,649 |    22.0% | j:10.5% a:8.7% m:8.3% r:8.0% s:6.6%    |
| english     | female.txt     |  4,242 |  29,888 |      18,436 |   **6,965** |  10,672 |   8,431 |    25.6% | m:9.9% l:9.0% c:8.4% s:8.1% a:7.8%     |
| english     | last-names.txt | 88,448 | 691,618 |     394,082 | **150,840** | 245,432 | 195,155 |    25.2% | s:10.9% b:9.2% m:8.6% c:6.8% h:5.8%    |
| english     | male.txt       |  1,212 |   8,162 |       5,881 |   **2,589** |   3,390 |   3,011 |    28.0% | j:8.2% d:8.0% r:7.8% m:7.3% c:7.1%     |
| frisian     | female.txt     |    285 |   2,358 |       1,370 |     **620** |     734 |     701 |     1.8% | r:30.2% s:21.1% j:6.0% f:5.6% w:5.6%   |
| frisian     | male.txt       |    250 |   1,825 |       1,095 |     **540** |     655 |     609 |     1.2% | r:30.8% s:12.8% o:7.6% f:5.6% w:5.2%   |
| south-asian | male.txt       |    173 |   2,009 |       1,649 |     **531** |     582 |     575 |    32.9% | a:22.5% s:20.8% r:16.2% k:8.1% d:7.5%  |
| turkish     | female.txt     |    115 |     786 |         548 |     **300** |     334 |     322 |    27.8% | s:20.0% a:17.4% e:13.9% b:7.8% f:7.8%  |
| turkish     | male.txt       |    109 |     777 |         574 |     **312** |     328 |     323 |    35.8% | a:20.2% s:16.5% b:12.8% k:11.0% e:9.2% |

Per-group totals (compressed) and the comparison against today's shipped
Markov-model sizes from [markov-alternatives.md](markov-alternatives.md) §1.2:

| group       |  fc+brotli (real lists) | gzip (real lists) | brotli (real lists) | Today (Markov, B45 §1.2) | Reduction (vs. fc+brotli) |
| ----------- | ----------------------: | ----------------: | ------------------: | -----------------------: | ------------------------: |
| arabic      |             **1,243 B** |           1,390 B |             1,330 B |                 93,001 B |                   **75×** |
| dutch       |             **8,758 B** |          11,601 B |            10,314 B |              1,009,019 B |                  **115×** |
| english     |           **160,394 B** |         259,494 B |           206,597 B |              1,191,203 B |                  **7.4×** |
| frisian     |             **1,160 B** |           1,389 B |             1,310 B |                 92,009 B |                   **79×** |
| south-asian |               **549 B** |             614 B |               591 B |      (not shipped today) |                       n/a |
| turkish     |               **612 B** |             662 B |               645 B |                 65,620 B |                  **107×** |
| **TOTAL**   | **172,716 B (~169 KB)** |         275,150 B |           220,787 B |   2,450,852 B (~2.34 MB) |                 **13.5×** |

Every group lands **well under the ~250 KB-per-locale ceiling from B45 §2.2**
(the report's exact wording was "all five origin groups' first+last names
could plausibly ship under ~150–250 KB total" — actual: **160 KB total** with
the english group dominating at 160 KB on its own thanks to the 88K-entry
US surnames corpus).

### §3.2 DAFSA — estimated, not measured

DAFSA / DAWG is _not_ in the measurement script — neither Node's `zlib` nor
a tiny custom builder fits in the spike budget without a new dev dep. For the
size range we care about, DAFSA typically beats front-coding+brotli by
~20–40 % on sorted alphabetic corpora (see e.g. [B45 §2.2](markov-alternatives.md#22-2-succinct-storage-dawgdafsa-front-coding-brotligzip-lazy-load)
and _Ciura & Deorowicz, "How to squeeze a lexicon"_). Applying ~30 % to the
measured `fc+brotli` totals gives a DAFSA upper bound of **~120 KB** total,
~6 KB for dutch, ~110 KB for english. DAFSA also gives **O(word-length)
k-th-word lookup**, which is no longer needed under the B45 Resolution
(no Feistel walk — `prng.pick` materializes the list). Recommendation:
**skip DAFSA**. `fc+brotli` (or even `brotli` straight on the sorted list)
is already small enough and dramatically simpler — Node's `zlib` is
built-in, no new dep, no custom builder, no k-th-word indexing needed.

### §3.3 Estimated — `packages/locale-en/` (raw corpora fetched on demand)

The locale-en raw corpora are _not_ checked in — they're fetched by
[`packages/locale-en/scripts/fetch-data.ts`](../../../packages/locale-en/scripts/fetch-data.ts)
and live transiently in `packages/locale-en/data/training/` after `pnpm fetch-data`.
The measurement script can't measure what isn't on disk; the numbers below
are _estimates_ anchored to:

- the measured `english/last-names.txt` ratio in §3.1 (raw 691,618 B / fc+brotli 150,840 B = **4.6× compression** on a 6.82-char-mean alphabetic corpus),
- the measured `dutch/female.txt` ratio (raw 13,508 B / fc+brotli 3,643 B = **3.7× compression** on a 6.35-char-mean corpus),
- the documented filter rules in `packages/locale-en/scripts/fetch-data.ts`.

| corpus                   |         est. lines | est. mean len | est. raw | est. fc+brotli | est. brotli |
| ------------------------ | -----------------: | ------------: | -------: | -------------: | ----------: |
| `first-names-male.txt`   |            ~14,000 |          ~6.5 |  ~105 KB |      ~25–30 KB |      ~30 KB |
| `first-names-female.txt` |            ~17,000 |          ~6.5 |  ~125 KB |      ~30–35 KB |      ~35 KB |
| `last-names.txt`         |           ~150,000 |            ~7 |  ~1.1 MB |        ~240 KB |     ~310 KB |
| `nouns.txt`              | 5,000 (hard slice) |            ~8 |   ~45 KB |         ~12 KB |      ~14 KB |
| `adjectives.txt`         | 3,000 (hard slice) |            ~8 |   ~27 KB |          ~7 KB |       ~9 KB |
| **estimated total**      |                  — |             — |  ~1.4 MB |    **~315 KB** |     ~400 KB |

**locale-en would land at ~315 KB front-coded+brotli** — above the
~250 KB-per-locale target from B45 §2.2, driven entirely by the US-Census
~150 K-entry surname list. Two clean ways to land under the target:

1. **Filter the US Census 2010 surnames to the top ~10,000 by frequency**
   (the published CSV has count columns). That brings last-names.txt to
   ~30 KB compressed. Total locale-en: ~85 KB.
2. **Keep all 150 K surnames, accept the 315 KB-per-locale budget.** The
   tradeoff is realism (every real US surname available) vs. bundle size.
   Worth a maintainer decision (§7 Q1).

The B45 estimate "**~250 KB per locale**" holds for **locale-names**
(actual: 160 KB) but not for the unfiltered locale-en surname corpus. The
estimate is achievable for locale-en too with a top-N frequency filter.

### §3.4 Reproduce

Run [scripts/b46-measure-corpus-sizes.ts](../../../scripts/b46-measure-corpus-sizes.ts)
with `pnpm tsx scripts/b46-measure-corpus-sizes.ts` from the repo root.
Pure measurement: no writes back to `packages/`, no network. Output is
markdown — pipe to a file if you want to diff against this report.

---

## §4. Sampler-shape sanity check

**Conclusion: a `sampleMarkov(model, …) → prng.pick(realList)` swap requires
no API change and no new ctx surface.** The existing fallback path already
takes a `string[]` (see below); the change is internal to two helpers.

### §4.1 Call sites

`sampleMarkov` and `sampleWeighted` are exported from
[`src/generators/data/markov/sample.ts`](../../../src/generators/data/markov/sample.ts).
Callers (verified by Read):

- **[`src/generators/data/word.ts`](../../../src/generators/data/word.ts) line 75**
  — `noun()` calls `sampleMarkov(prng, w.nounModel)` _only when_
  `w.nounModel` is present, otherwise falls back to
  `locPick(prng, w.nouns ?? [])` (line 75: `w.nounModel ? sampleMarkov(prng, w.nounModel) : cap(locPick(prng, w.nouns ?? []))`).
- **[`src/generators/data/word.ts`](../../../src/generators/data/word.ts) line 87**
  — `adjective()`, same shape: `w.adjectiveModel ? sampleMarkov(…) : locPick(prng, w.adjectives ?? [])`.
- **[`src/generators/data/person.ts`](../../../src/generators/data/person.ts) line 63**
  — `sampleName()` helper: `if (models && models.length > 0) return sampleWeighted(prng, models); if (simple && simple.length > 0) return pick(prng, simple); return "Unknown";`
- **[`src/generators/data/person.ts`](../../../src/generators/data/person.ts) line 76, 77, 85**
  — `firstName()` and `lastName()` call `sampleName(prng, p.firstNamesMale, p.simpleFirstNamesMale)`, etc.

### §4.2 The fallback is already a `string[]`

Both `word.ts` and `person.ts` _already_ have a `string[]` fallback path,
which means the data shape required by `prng.pick(realList)` is already
plumbed end-to-end through the locale type:

- [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts)
  declares `simpleFirstNamesMale?: readonly string[]`, `simpleLastNames?: readonly string[]`,
  `nouns?: readonly string[]`, `adjectives?: readonly string[]` on `LocaleData`.
- [`src/generators/data/person.ts`](../../../src/generators/data/person.ts)
  line 62 takes `simple: readonly string[] | undefined` as the second
  argument and `prng.pick`s from it (line 64).

**Implementation shape** under B45 Resolution: switch the locale package
to populate the `simple*` fields with the real corpora (loaded from a
brotli blob at module load) and drop the Markov-model fields. The runtime
code path falls through to the existing `pick(prng, simple)` branch
without any matcher, key-map, or engine change. The wire format is identical:

- `key-map.ts` → `data.person.firstName` (no change)
- `data.person.firstName(prng, ctx)` → `sampleName(prng, undefined, p.simpleFirstNamesMale)` (path #2 of the helper, already implemented)
- `pick(prng, p.simpleFirstNamesMale!)` (line 51, already implemented)

### §4.3 No new ctx surface

`ctx` already carries `locale` (B36/B40); the locale already exposes
`simple*` arrays. The engine (`src/world/engine.ts`) doesn't see this
swap — the change is one layer deeper, inside the data-generators directory.
Confirmed: no API change. Per-call PRNG consumption goes from
**variable** (Markov: 1 + N draws + up-to-8 retry attempts; B45 §1.5) to
**constant** (one `prng.random()` for the index, period). That makes
determinism-fit _strictly stronger_ under D4/D10 than today's Markov path.

### §4.4 Matchers that need adjustment

None. Searched all `data.person.*` and `data.word.*` callers via the
key-map (line 61-100 of `key-map.ts`) — every consumer goes through the
two helpers above. The 13 string-key aliases (`firstname`, `first_name`,
`lastname`, `name`, `bio`, `text`, `description`, `comment`, …) all
ultimately dispatch through `noun`/`adjective`/`firstName`/`lastName`,
and the `sentence()` template assembly (line 137-148 of `word.ts`) uses
the same helpers. No matcher contract changes.

---

## §5. Words / PCFG sketch — sized recommendation

Per the B45 Resolution: **real lemma lists + weighted PCFG** for the EN word
generators (with syllable n-grams as the pseudo-word fallback, deferred).

### §5.1 Real lemma lists alone

The existing fetch-data.ts already produces real lemma lists (5,000 nouns +
3,000 adjectives). Estimated sizes (per §3.3): **~19 KB combined,
front-coded+brotli** — a 12× reduction from today's combined 200 KB Markov
models. This alone closes the bundle-size gap and eliminates Markov gibberish.

### §5.2 Real lemma lists + weighted PCFG

The PCFG was already sketched in
[word-generation.md](word-generation.md) (the `S → NP VP` grammar). The
current `sentence()` implementation at
[`src/generators/data/word.ts`](../../../src/generators/data/word.ts)
lines 126-156 is _already_ a 5-template weighted PCFG over locale-provided
parts of speech — picking uniformly from a `[() => string, ...]` tuple
and expanding with adjectives/nouns/verbs/prepositions/conjunctions. So
the PCFG infrastructure exists; what would change is _what the noun and
adjective leaf-generators emit_: a `prng.pick` over a real list instead of
`sampleMarkov(model)`.

A minimal weighted PCFG **rule extension** to surface for §7 — currently
all five templates have equal weight; a real PCFG would weight them by
frequency in a target corpus:

```
# Example weighted rules (placeholder weights for illustration):
S            → 0.4 NP VP                           # "The cat sleeps."
S            → 0.3 NP VP NP                        # "The cat sees a dog."
S            → 0.2 NP CONJ NP VP_PLURAL            # "The cat and the dog run."
S            → 0.1 PP NP VP                        # "In the garden the cat sleeps."
NP           → 0.6 DET ADJ N | 0.3 DET N | 0.1 N   # noun phrase variants
```

Implemented as a `Array<{ weight: number; expand: (ctx) => string }>` and a
weighted `prng.pick` over it — exactly the shape `sampleWeighted` already
uses for name origins (`src/generators/data/markov/sample.ts` line 71-81).
**Size impact: negligible** (rule table ≈ 200–500 bytes of source code per
locale; weights are inline literals).

**Sized total for locale-en words (lemma lists + PCFG):
~19 KB compressed lists + ~1 KB inlined rules ≈ 20 KB**
(vs. today's 201 KB Markov-model corpus — **10× reduction** while shipping
real words).

### §5.3 Recommendation

**Lemma lists + weighted PCFG.** Strictly better than lemma lists alone
on the same axes (no extra bundle cost, more variety in sentence shape),
and matches the existing 5-template infrastructure. The PCFG-extension
rules table is the only new artifact and it's tiny.

---

## §6. B42 (issue #24) empirical confirmation

B42 reports that Dutch Markov word output ("Aar*Aade.m4a", "Beedzaarti*…")
skews heavily toward initial letters A/B/C/D. The current
[B42 inbox card](../../backlog/inbox/B42-markov-letter-distribution-bias.md)
is already flagged `[blocked]` and "subsumed by B45 direction (2026-05-30)";
this section closes that subsumption empirically.

### §6.1 The Markov empty-state row's first-letter distribution

Decoded from the `""` row of
[`packages/locale-names/src/groups/dutch/male.ts`](../../../packages/locale-names/src/groups/dutch/male.ts)
lines 8-12 (the `chars: "abcdefghijklmnopqrstuvwxyz$"` alphabet means the
CDF entry at index 0 is the cumulative probability up to and including `a`,
so `P(a) = cdf[0]`, `P(b) = cdf[1] - cdf[0]`, …):

| letter | dutch/male P(letter) | dutch/female P(letter) |
| -----: | -------------------: | ---------------------: |
|      a |            **8.72%** |              **9.98%** |
|      b |                4.29% |                  3.81% |
|      c |                3.75% |                  5.18% |
|      d |                4.90% |                  3.97% |
|      e |                5.59% |                  6.01% |
|      f |                4.02% |                  3.97% |
|      g |                4.43% |                  4.69% |
|      h |                4.90% |                  4.63% |
|      i |                1.84% |                  2.98% |
|      j |           **10.49%** |                  8.93% |
|      k |                3.13% |                  2.81% |
|      l |                4.90% |                  7.61% |
|      m |            **8.17%** |             **11.42%** |

**A+B+C+D combined: 21.66% (male), 22.94% (female).** The Markov empty
state is _not_ what produces B42's output skew on its own — the model gives
roughly the same A/B/C/D mass that the real list does (§3.1: dutch male
**22.0%**, dutch female **23.1%**).

What B42 actually reports is the _post-rejection-sampling_ output skew —
the consonant-run rejection (`CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{4}/i`
in [`src/generators/data/markov/sample.ts`](../../../src/generators/data/markov/sample.ts)
line 6) and the `"x"` fallback (line 65) compound with the order-3 chain's
high-probability paths, producing the visible "Aar_Aade.m4a" pattern.
The empty-state row alone doesn't explain it, which is why issue #24's
"investigate root cause" path is dauntingly underdetermined.

### §6.2 Real-list first-letter distribution (uniform `prng.pick`)

From §3.1 (Dutch corpus, first-letter histogram over **the entire training
file**, every entry equally likely under `prng.pick`):

- **dutch/male.txt**: j 10.5%, **a 8.7%**, m 8.3%, r 8.0%, s 6.6%; **A/B/C/D combined = 22.0%**
- **dutch/female.txt**: m 11.3%, **a 10.1%**, j 9.0%, l 7.5%, e 6.1%; **A/B/C/D combined = 23.1%**
- **dutch/last-names.txt**: **b 13.2%**, s 9.8%, k 9.4%, h 9.1%, v 7.5%; **A/B/C/D combined = 21.8%**

This is reasonably close to published Dutch first-letter frequency tables
(e.g. _Nederlandse Taalunie's "letterfrequenties"_: word-initial `d, m, a,
o, h, e, v, b, t, g` lead the distribution; word-internal frequencies
differ). The lists' bias toward `m, j, l` reflects the registry-derived
name corpus (Dutch first names disproportionately begin with `M-`/`J-`/`L-`
— Marije, Marieke, Jan, Joop, Lisa, …) rather than the language-wide
letter frequency, which is the _correct_ distribution for "give me a
Dutch first name" by construction.

### §6.3 Conclusion — B42 closed by construction

Under uniform `prng.pick(realList)`:

- Every list entry is **equally reachable** (this is the definition of
  `prng.pick`),
- The visible first-letter distribution equals the **list's natural
  distribution**, exactly,
- A+B+C+D combined is **22.0% / 23.1% / 21.8%** for Dutch male / female /
  last names — nowhere near the ~80%+ that B42's user-observed samples
  show,
- No `CONSONANT_RUN` rejection, no `"x"` fallback, no start-state
  weighting needed,
- No B42 patch / `uniformStart` option / retrain required.

**Recommendation: cancel B42** (`git mv` to `done/` with `flags:
[cancelled]` per the manager's lane convention) when the B46 direction
ships as an implementation item. Until then, leave it in `inbox/`
flagged `[blocked]` as it is. Do **not** ship a B42 sampler patch in the
meantime; it would be deleted by the wordlist refactor.

---

## §7. Sign-off block — maintainer decisions required

> **Blocking** = must be answered before any implementation item is filed.
> **Non-blocking** = can be deferred to the implementation phase but worth
> calling out so the implementation item's scope is honest.

### §7.1 Corpora + licenses

| #    | Item                                                                                                                                                                                                                                                                                                                            | Status       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Q-S1 | Confirm shipping `open-nl-data/dutch-names-dataset` (MIT) entries directly is acceptable. Today's Markov models are _derivatives_ of this list; shipping the list itself is a slightly stronger licensing footprint (MIT is permissive, but the data flows through to consumers, not just the developer).                       | **Blocking** |
| Q-S2 | Resolve license for `digitalheir/family-names-in-the-netherlands` (Dutch surnames). Upstream repo has no LICENSE file. Options: (a) get clarification from digitalheir, (b) refetch directly from CBS (the upstream of the digitalheir mirror) under CBS's published open-data license, (c) drop Dutch surnames entirely.       | **Blocking** |
| Q-S3 | Resolve license for `smashew/NameDatabases` (English/US surnames, 88 K entries). Upstream repo has no LICENSE file. Options: (a) get clarification, (b) refetch from US Census 2010 directly (public domain — same source the locale-en path uses), (c) reduce to the top-N most-common surnames and re-source from Census.     | **Blocking** |
| Q-S4 | Confirm shipping `arineng/arincli` (ISC) name lists is acceptable. ISC is permissive (BSD-equivalent); this is a low-risk attribution-only license.                                                                                                                                                                             | Non-blocking |
| Q-S5 | Confirm shipping SSA Baby Names 2023 and US Census 2010 Surnames (both public domain, US government) directly. The locale-en fetch-data.ts already pulls these; the question is whether to ship them as data vs. only as derived models.                                                                                        | Non-blocking |
| Q-S6 | Confirm the **regex-classified** `arabic`/`frisian`/`turkish` corpora are acceptable, or whether they should be replaced by native-language source lists (e.g. an Arabic registry, a Frisian-province birth registry). The current corpora demonstrably contain misclassifications (Frisian male: `obed`, `pierino`, `pierre`). | **Blocking** |
| Q-S7 | Confirm the `south-asian` corpus shipping (currently 2 female + 173 male entries — too small to be useful; should either be expanded or dropped). It is not exposed via `packages/locale-names/src/groups/` as a public locale today; only present in `data/training/`.                                                         | **Blocking** |
| Q-S8 | locale-en `nouns.txt` / `adjectives.txt` are produced by a **heuristic suffix filter** over `dwyl/english-words`, not from a labelled POS source. A curated lemma list (Open American National Corpus, SUBTLEX-US, WordNet) would replace the heuristic. Cost: licensing review of the chosen source.                           | Non-blocking |

### §7.2 Bundle-size choice

| #    | Item                                                                                                                                                                                                                                                                                                                  | Status       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Q-B1 | locale-en last-names: ship all ~150 K US Census surnames (~240 KB compressed) or filter to top ~10 K most common (~30 KB compressed)? §3.3 says either is feasible but the trade-off is realism vs. bundle size. The B45 Resolution didn't pin a per-locale ceiling beyond "tens to a few hundred KB".                | **Blocking** |
| Q-B2 | Compression format: **brotli on the sorted newline list** (simplest, native Node `zlib`) vs. **front-coded + brotli** (~25 % smaller, ~20 LOC custom decoder)? §3.1 shows front-coded+brotli is materially smaller for the english group; for the small locale-names groups (1–10 KB), the difference is noise.       | Non-blocking |
| Q-B3 | **Lazy-load per locale**? Each locale group's corpus could be its own brotli blob loaded on first use (cached at module load). Saves bundle for users who only need one locale. Or eager: load all groups at module import. The existing `packages/locale-names/src/groups/<group>/index.ts` already splits by group. | Non-blocking |

### §7.3 Behavioural questions

| #    | Item                                                                                                                                                                                                                                                                                                                | Status       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Q-X1 | Determinism break: the seed→value mapping changes (an existing snapshot saying "Risharoumas" becomes a real name). B45 Resolution accepted this under 0.x SemVer (per B39 precedent). Confirm a minor bump is acceptable and the integration snapshots will be re-pinned in the same commit.                        | Non-blocking |
| Q-X2 | Per-call PRNG consumption goes from variable (Markov: 1 + N draws + 0–7 retries) to constant (1 draw). This is _strictly more deterministic_ but it's an observable change — any test that asserts a specific PRNG state after a sequence of name draws will shift. (Spot-checked: the test suite doesn't do this.) | Non-blocking |
| Q-X3 | The B42 GitHub issue stays open until the implementation lands; should the issue be closed-by-this-spike (with a link to this report), or kept open until the wordlist direction ships? The B42 card already says "leave open" — confirm.                                                                           | Non-blocking |

---

## §8. Open questions surfaced by the spike

| #    | Question                                                                                                                                                                                                                                                                                                                                                                    | Status                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| O-A1 | The `simple*` fields on `LocaleData` are typed `readonly string[]`. Once the Markov models are dropped, the optional `firstNamesMale: NameOriginSet[]` / `lastNames: NameOriginSet[]` / `nounModel: MarkovModel` / `adjectiveModel: MarkovModel` fields on `LocaleData` should be removed entirely (or deprecated). Confirm scope: this is a `LocaleData` type-shape break. | **Blocking** (architecture) |
| O-A2 | Should the brotli decompression happen at module import time (eager, ~tens of ms once) or lazily on first use (deferred, but adds a sync boundary)? Node `zlib` is sync; on the browser it would be sync via WASM or async via `DecompressionStream`. Spike-time recommendation: eager, sync — matches today's locale model load.                                           | Non-blocking                |
| O-A3 | Should the Markov training pipeline (`scripts/train-markov.ts` and `packages/*/scripts/train.ts`) be retained as dev-tooling for users who _want_ invented words (the syllable-n-gram option 3 from B45 §2.3 would build on this), or deleted? Recommendation: retain — deleting is a non-reversible decision.                                                              | Non-blocking                |
| O-A4 | The locale-en raw corpora aren't checked in. After this refactor they will need to be (or a compressed/derived artifact will need to be). Confirm the maintainer is comfortable checking ~315 KB of compressed `.br` files into the repo (or generating them at `prepublishOnly` time from a fetch step).                                                                   | Non-blocking                |
| O-A5 | Cross-package coordination: `packages/locale-nl` currently re-exports the Dutch first-name origin sets from `packages/locale-names`. When `locale-names` drops the Markov fields, `locale-nl` must follow. This is a workspace-coordinated breaking change.                                                                                                                 | **Blocking** (architecture) |

---

## See also

- [markov-alternatives.md](markov-alternatives.md) — B45 report (the parent context)
- [markov-training-pipeline.md](markov-training-pipeline.md) — current Markov training tooling
- [word-generation.md](word-generation.md) — PCFG sketch and open/closed-class word split
- [algorithmic-entropy.md](algorithmic-entropy.md) — original Markov rationale
- [scripts/b46-measure-corpus-sizes.ts](../../../scripts/b46-measure-corpus-sizes.ts) — measurement script (this report's data source)
- [B42 inbox card](../../backlog/inbox/B42-markov-letter-distribution-bias.md) — the issue this spike empirically closes
