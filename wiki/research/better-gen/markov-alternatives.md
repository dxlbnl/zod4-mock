# Alternatives to Char-Level Markov for Name / Word Generation (B45)

> **Research item B45.** Read-only investigation; no code/generator changes. Evaluates
> six alternatives to the current character-level Markov approach for **names and words**
> against quality / size / generation time / uniqueness / determinism-fit /
> implementation cost, anchored to *measured* repo data. Recommends a direction and a
> concrete spike for the manager to spin off, pending user sign-off.
>
> Complements (does not duplicate) [algorithmic-entropy.md](algorithmic-entropy.md),
> [word-generation.md](word-generation.md), [name-origin-distribution.md](name-origin-distribution.md),
> [markov-training-pipeline.md](markov-training-pipeline.md). Coordinates with backlog
> **B2** (Markov entropy for unkeyed synthetic strings) and **B42** (nl initial-letter
> distribution bias, issue #24).

---

## 1. Baseline — the measured current cost

All sizes are **measured** (`du -sb`, `wc -l`, `gzip -c | wc -c`) on the committed
`.ts` source artifacts on 2026-05-29. These are TypeScript source files (the `dist/`
was not built at measurement time), so they represent the *shipped, uncompressed,
parsed-by-V8* form. Numbers are bytes unless noted.

### 1.1 `locale-en` word + name models (`packages/locale-en/src/models/`)

| File | Bytes | Lines | Order |
|------|------:|------:|:-----:|
| `first-names-male.ts` | 112,692 | 452 | 2 |
| `first-names-female.ts` | 101,772 | 409 | 2 |
| `last-names.ts` | 128,435 | 514 | 2 |
| `nouns.ts` | 109,127 | 438 | 2 |
| `adjectives.ts` | 91,607 | 369 | 2 |
| `index.ts` | 278 | 5 | — |
| **Total** | **543,911** (~531 KB) | 2,187 | |

The card's "~540 KB for `locale-en`" estimate is **accurate** — confirmed at 543,911 B.

### 1.2 `locale-names` shared origin models (`packages/locale-names/src/groups/`)

| Group | Files (bytes) | Group total |
|-------|---------------|------------:|
| `dutch` | male 467,123 (o3) · female 459,987 (o3) · last-names 81,754 (o2) | 1,009,019 |
| `english` | male 415,630 (o3) · female 609,123 (o3) · last-names 166,286 (o2) | 1,191,203 |
| `arabic` | male 43,982 (o2) · female 48,923 (o2) | 93,001 |
| `frisian` | male 48,078 (o2) · female 43,833 (o2) | 92,009 |
| `turkish` | male 33,088 (o2) · female 32,434 (o2) | 65,620 |
| **Total** | | **2,450,852** (~2.34 MB) |

The card's "~3.5 MB across `locale-names`" estimate is **high**: the actual committed
corpus is **2.34 MB**. The combined name-generation footprint
(`locale-en/models` + `locale-names/groups`) is **2,994,763 B ≈ 2.86 MB**. The 3.5 MB
figure was likely a pre-trim estimate or counted other artifacts; the report uses the
measured 2.34 MB / 2.86 MB.

### 1.3 What drives the size — dense Float32-as-decimal-text CDFs

Each table row is the **full alphabet width** (27 entries: `a–z` + `$`), stored as
six-decimal text (`v.toFixed(6)`), *regardless of how many successors actually occurred*.
Two structural costs compound:

- **Density.** `dutch/male.ts` has **1,832 rows**, `english/female.ts` **2,389 rows**,
  `en/nouns.ts` **429 rows** — every row carries 27 cumulative floats even when only 1–2
  characters were ever observed. Example: the `"aac"` row in `dutch/male.ts` is uniform
  tiny increments (~0.0079 per step) until a jump to 1.0 at the last index — i.e. that
  state was seen but its successor distribution is **essentially all-prior noise** (a
  near-uniform smear), contributing no real signal yet costing a full 27-float row.
- **Order-3 blow-up.** The four order-3 models (`dutch` male/female, `english`
  male/female) are the heaviest (415–609 KB each). Order-3 multiplies the state count
  (the wiki notes ~600 → ~3,000–6,000 states); combined with dense rows this is the
  dominant cost. Order-2 origin models are 32–166 KB.

This text encoding is **highly compressible**: gzip on `dutch/male.ts` is
467,123 → 49,001 B (**9.5×**); the whole `locale-names` corpus gzips to **355,589 B**
(**6.9×**), and `locale-en/models` gzips to **152,431 B** (**3.6×**). The redundancy gzip
exploits — repeated `0.xxxxxx,` decimal tokens and prior-only rows — is precisely the
information the format wastes. This is a strong signal that both **binary quantization**
(§2.4) and **succinct storage** (§2.2) have large headroom.

### 1.4 Runtime sampler quality compromises (`src/generators/data/markov/sample.ts`)

The sampler is visibly fighting the model's output quality with band-aids:

- **Rejection sampling, up to 8 attempts** — `sampleMarkov` loops calling `sampleOnce`
  and rejects any word with a 4+ consonant run (`CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{4}/i`).
- **`"x"` sentinel fallback** — if all 8 attempts produce garbage, it returns the literal
  `"x"`. A mock-data library silently emitting `"x"` is a quality cliff.
- **Length steering** — a soft-max early-stop probability (`softMax = maxLen*0.6`) plus a
  hard `maxLen` wall, to stop the chain running to the wall (the "Risharoumas" failure).
- **Dead-end / restart** — on `$` before `minLen`, it resets `state`/`word` and restarts
  mid-call.

### 1.5 Per-call PRNG / time cost

- **Non-constant PRNG consumption.** Each emitted character = one `prng.random()` (the
  CDF draw); each soft-stop check that fires = another `prng.random()`; each rejected
  attempt re-runs the whole walk. So a single `sampleMarkov` call consumes a
  *data-dependent, variable* number of PRNG draws (roughly `wordLen + stopChecks`, ×
  up-to-8 attempts). This is deterministic for a fixed seed+model, but **fragile**: any
  change to the model, `minLen`/`maxLen`, or the rejection regex shifts how much state is
  consumed (see §3 determinism note).
- **Time.** Per character: one `random()` + an O(log 27) ≈ 5-step binary search over the
  dense CDF. Cheap per char, but the up-to-8× rejection multiplier and restarts make
  worst-case latency a multiple of the happy path.
- **`sampleWeighted`** adds one `random()` + a linear scan over origin sets before
  delegating to `sampleMarkov`.

**Baseline summary:** ~2.86 MB of name+word models shipped (2.34 MB names + 0.53 MB EN
words), dominated by dense order-3 text CDFs that gzip 7–9×; output quality is propped up
by rejection sampling + an `"x"` fallback; **no uniqueness guarantee** (Markov can and
does repeat, and offers no non-repeating enumeration).

---

## 2. Comparison of the six alternatives

Scoring legend: ✅ strong · 🟡 moderate / conditional · ❌ weak. "Determinism-fit" =
how cleanly it slots into D4/D10 (`fork(key)` + per-schema slot, constant/predictable
PRNG consumption).

### 2.1 (1) Real wordlists + combinatorial product + Feistel/format-preserving permutation

Store *real* first/last names as plain lists; compose fields (e.g. `firstName ×
lastName`); enumerate the product space **uniquely and shuffled** via an index
permutation (a Feistel network / format-preserving permutation, FPE) seeded from the
field PRNG. A 5k × 5k product = 25M unique full names from ~50–100 KB of real data.

- **Quality:** ✅ Every value is a real, human-vetted name. No gibberish, no `"x"`, no
  rejection sampling. This is the single biggest quality jump available.
- **Size:** ✅ Real first+last lists are tiny vs the models. ~5k names × ~7 chars ≈ 35 KB
  raw each, far under the current per-locale model cost; with §2.2 storage, smaller.
- **Generation time:** ✅ O(1) per value: permute an index, then two array lookups. No
  per-char loop, no rejection.
- **Uniqueness:** ✅ **The decisive advantage.** A Feistel/FPE over `[0, N)` is a
  *bijection* → guaranteed non-repeating enumeration over the whole product space, which
  Markov fundamentally cannot offer. Ideal for "give me 10,000 distinct users."
- **Determinism-fit:** ✅ Excellent and *constant-consumption*: the permutation is a pure
  function of `(fieldPrng-derived key, index)` — see §3. Far more robust than Markov's
  variable draw count.
- **Implementation cost:** 🟡 Moderate. Needs a small, well-understood Feistel/FPE
  routine (a few rounds of an FNV/splitmix-based round function over half-words), a
  per-slot index counter, and curated real lists. The crypto-grade rigor of FF1/FF3 is
  **not** needed (no security claim) — a 3–4-round balanced Feistel suffices for a
  shuffle.

### 2.2 (2) Succinct storage (DAWG/DAFSA, front-coding, brotli/gzip lazy-load)

Store the real lists (from §2.1) compactly: a **DAWG/DAFSA** (merge shared prefixes *and*
suffixes; supports k-th-word indexing, which pairs perfectly with the Feistel index in
§2.1), **front-coding** (store each sorted word as `sharedPrefixLen + suffix`), or simply
**brotli/gzip newline lists lazy-loaded per locale**.

- **Quality:** ✅ Storage format is orthogonal to quality — the data is still real lists.
- **Size:** ✅ Large win. *Measured* gzip on the current corpus already hits 6.9×
  (2.34 MB → 356 KB) on the *wasteful* CDF text; on plain newline wordlists the gain is
  even better in absolute terms because the payload is far smaller to begin with.
  **Estimate (reasoned):** ~5k real names ≈ 35 KB raw → front-coding on sorted lists
  typically removes 40–60 % (shared prefixes) → ~15–20 KB → gzip/brotli to ~6–10 KB per
  list. A DAFSA over a 5k-name list is commonly ~5–15 KB. So **all five origin groups'
  first+last names could plausibly ship under ~150–250 KB total** — well under the
  current 2.34 MB, while shipping *real* data. (Estimates; exact numbers require building
  the structures on the real corpora — that is the spike's measurement task.)
- **Generation time:** 🟡 brotli/gzip needs a one-time decompress per locale (lazy, cached
  → amortized to ~0). A DAWG with rank/select for k-th-word indexing is O(word length)
  per lookup — fast, and avoids materializing the full list.
- **Uniqueness:** ✅ DAWG k-th-word indexing composes directly with §2.1's Feistel index.
- **Determinism-fit:** ✅ Decompression/decoding is pure and happens before any PRNG use;
  PRNG only drives the index.
- **Implementation cost:** 🟡 brotli/gzip lazy-load is low cost (Node has `zlib`
  built-in; bundle ships a compressed blob + a tiny loader). A hand-rolled DAFSA builder
  is higher cost but is build-time-only tooling, not runtime.

### 2.3 (3) Syllable-level composition / n-grams

Compose from **whole syllables** (onset/nucleus/coda or syllable n-grams) instead of
character n-grams. This is the *smarter* version of the abandoned 3-state phoneme
combinatorics (§ [word-generation.md](word-generation.md)): a syllable inventory + a
syllable-transition model.

- **Quality:** ✅ Far less gibberish than char-Markov — syllables are valid by
  construction, eliminating 4-consonant dead-ends, so **no rejection sampling and no `"x"`
  fallback needed**. Reads as plausible pseudo-words.
- **Size:** ✅ Fewer states than char order-3 (a few hundred syllables + transitions vs
  thousands of char trigrams). Estimate: comparable to or smaller than order-2 char models.
- **Generation time:** ✅ Few syllables per word → fewer PRNG draws than per-character;
  no rejection loop.
- **Uniqueness:** ❌ Still generative/probabilistic — no non-repeating guarantee.
- **Determinism-fit:** ✅ Cleaner than char-Markov: bounded, near-constant draws (one per
  syllable, no restarts/rejections), so PRNG consumption is far more stable under model
  edits.
- **Implementation cost:** 🟡 Needs a syllabification pass at *training* time to build the
  syllable inventory + transition table (non-trivial tooling, language-specific). Runtime
  sampler is simpler than today's. **Best fit for pseudo-*words*** (nouns/adjectives)
  where realness isn't required; weaker for names (real lists win there).

### 2.4 (4) Keep Markov but shrink it (quantize + prune)

Quantize the `Float32`/decimal CDFs to **int8/int16**, and **prune** rows to sparse
**top-k** successors (drop the prior-only smear documented in §1.3).

- **Quality:** 🟡 Unchanged-to-slightly-better. Pruning the all-prior tail actually
  *reduces* the chance of drawing a nonsense character; quantization to int16 is
  perceptually lossless for sampling. Does **not** fix the core gibberish/uniqueness
  problems — it's a size band-aid.
- **Size:** ✅ Large, low-risk win. Replacing 6-decimal text (~9 bytes/value) with int16
  (2 bytes) is ~4.5× on the value payload; int8 is ~9×. Dropping prior-only rows + top-k
  pruning compounds it. The card's **4–8× estimate is well-supported** — and consistent
  with the *measured* 6.9× gzip ratio, which is essentially the entropy floor this
  redundant text sits above. Could bring 2.34 MB → ~300–550 KB.
- **Generation time:** ✅ Same or faster (smaller arrays, better cache locality; sparse
  rows shorten the binary search).
- **Uniqueness:** ❌ Still none.
- **Determinism-fit:** ✅ Same sampler shape, same `fork(key)` usage — **but pruning/
  re-quantizing changes the CDF**, which **changes sampled output and PRNG consumption**
  → a deterministic-output break (seed N no longer maps to the same name). Acceptable as a
  versioned retrain, but it *is* an observable behavior change (D4 keys are fine; the
  *values* shift).
- **Implementation cost:** ✅ **Lowest** — a re-encode in `train-markov.ts` + decode tweak
  in `sample.ts`. No new data, no API change. Ideal **stopgap**.

### 2.5 (5) Neural (char-RNN / tiny transformer)

- **Quality:** 🟡 Potentially high, but overkill for mock data.
- **Size:** ❌ Even a "tiny" char-RNN is hundreds of KB–MB of weights, *plus* a runtime
  (matmul/inference) — strictly worse than every option above.
- **Generation time:** ❌ Matrix ops per character; orders of magnitude slower than a
  table lookup.
- **Uniqueness:** ❌ None.
- **Determinism-fit:** ❌ Floating-point inference determinism across platforms/JS engines
  is fragile (non-associative FP, WASM vs JS); reproducing exact seed→value across
  environments is hard. Introduces a heavy runtime dependency.
- **Implementation cost:** ❌ Very high (inference runtime, weight format, training infra).
- **Verdict:** **Dismiss.** Documented here so it's settled: a zero-dependency,
  deterministic, byte-tiny table/list approach beats a neural model on *every* axis this
  library cares about. Mock data does not need generative novelty; it needs realism,
  speed, size, and reproducibility.

### 2.6 (6) Words specifically — pseudo-words vs real lists; PCFG over real words

For **open-class words** (nouns/adjectives/verbs) the choice is generated pseudo-words
(syllable §2.3 or char-Markov today) vs **real closed-vocabulary lists**; for sentences,
**weighted PCFG / grammar templates over real words** vs stitching Markov-invented words.

- **Quality:** ✅ Real word lists + a small weighted PCFG (the `S → NP VP` grammar already
  sketched in [word-generation.md](word-generation.md)) read as real language, not
  invented gibberish. This is what most UI mock data actually wants ("lorem-ipsum that
  looks like the target language").
- **Size:** ✅ A few thousand common real lemmas per POS per locale ≈ tens of KB
  (front-coded/compressed, §2.2) — far under the current ~0.53 MB EN word models.
- **Generation time:** ✅ `prng.pick` over a list + a tiny grammar = trivial.
- **Uniqueness:** 🟡 Words repeat naturally (real text repeats words); for *unique*
  word-y identifiers, the §2.1 Feistel-over-product trick applies (e.g. adjective × noun).
- **Determinism-fit:** ✅ `prng.pick` is already a core, constant-consumption primitive.
- **Implementation cost:** 🟡 Source + license real lemma lists per locale (closed-class
  function words are already real per the existing design); build the PCFG table (small).
- **Verdict:** **Real lists + weighted PCFG win for words.** Markov-invented words are the
  worst of both: gibberish *and* model bloat.

### 2.7 Comparison table

| Option | Quality | Size | Gen time | Uniqueness | Determinism-fit | Impl cost |
|--------|:------:|:----:|:--------:|:----------:|:---------------:|:---------:|
| (1) Real lists + product + **Feistel/FPE** | ✅ | ✅ | ✅ | ✅ (bijection) | ✅ (constant) | 🟡 |
| (2) Succinct storage (DAWG / front-code / brotli) | ✅ | ✅ | 🟡 (1× decode) | ✅ (k-th index) | ✅ | 🟡 |
| (3) Syllable n-grams | ✅ | ✅ | ✅ | ❌ | ✅ | 🟡 |
| (4) Keep Markov, quantize + prune | 🟡 | ✅ (4–8×) | ✅ | ❌ | 🟡 (values shift) | ✅ (lowest) |
| (5) Neural (char-RNN / transformer) | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ |
| (6) Words: real lists + weighted PCFG | ✅ | ✅ | ✅ | 🟡 (via §1 trick) | ✅ | 🟡 |

---

## 3. Determinism analysis for the top candidate(s)

The binding rule (architecture.md, D4/D10): generation MUST be deterministic per
`(seed + schema reference + per-schema call slot)`; within a record, `fork(fieldName)`
isolates fields; the slot is a module-global `WeakMap<ZodTypeAny, number>` keyed on schema
*reference identity*. `Prng.fork(key)` derives an independent child PRNG from
`fnv1a(`${seed}:${key}`)` **without consuming** the parent's state.

### 3.1 Feistel / format-preserving permutation (option 1) — the key design

The goal: from the per-field PRNG, produce a **deterministic, non-repeating** stream of
unique indices into a product space of size `N = |firstNames| × |lastNames|` (or a single
list of size `N`).

1. **Seed the permutation from the field PRNG.** The field already has a forked PRNG
   (`prng = parent.fork(fieldName)`, seed = `fnv1a(worldSeed:subjectId:fieldPath)`). Draw
   a 32-bit permutation key from it once: `permKey = prng.bytes(4)` (or `uint32`). This
   key *is* the permutation's identity — derived purely from the determinism tuple, so it
   already inherits D4/D10's stability (schema reference + slot + field name).
2. **Pick the i-th value.** For the i-th record using this schema slot, compute
   `idx = feistel(permKey, i) mod N` — actually a cycle-walking FPE over `[0, N)`:
   `feistel` is a balanced Feistel network whose round function is
   `splitmix32(roundKey ⊕ half)` (the repo already ships `splitmix32` and `fnv1a` in
   `prng.ts`). A few (3–4) rounds give a thorough shuffle; this is *not* security-grade
   and doesn't need to be.
3. **Bijection ⇒ non-repeating.** Because `feistel(permKey, ·)` is a bijection on
   `[0, N)`, iterating `i = 0,1,2,…` yields every index exactly once before repeating —
   **guaranteed uniqueness** that no Markov chain can provide.
4. **Decode index → value.** `firstName = firstNames[idx / |lastNames|]`,
   `lastName = lastNames[idx % |lastNames|]` (or a DAWG k-th-word lookup, §2.2).

**Why this is a strictly better determinism fit than Markov:** the per-record PRNG
consumption is *constant and structural* (one permutation key draw + arithmetic), versus
Markov's *data-dependent, variable* draw count (§1.5) that silently shifts whenever the
model or sampler params change. The "call slot" `i` is exactly the per-schema slot D10
already maintains. No rejection sampling, no `"x"`, no restart consuming extra state.

**Open determinism question:** what is `i` and where does the count live? The cleanest fit
is to reuse the existing per-schema slot counter (the `WeakMap` index that D10 already
advances per call on a schema reference) as the Feistel input, so order across *distinct*
schemas still doesn't matter (D4) while same-schema repeats walk the permutation. The
spike must pin this against D9 (cache hits stay PRNG-/counter-neutral).

### 3.2 Succinct storage (option 2) and PCFG (option 6)

Both are determinism-neutral: decompression/DAWG-decode is a pure function executed before
any PRNG draw; the PRNG only ever drives an *index* or a `prng.pick`. They slot in without
touching D4/D10 — the permutation/index machinery of §3.1 sits on top unchanged.

### 3.3 Quantize/prune (option 4)

Same `fork(key)` shape as today (✅ for D4/D10 *keys*), but re-encoding the CDF **changes
the values drawn** for a given seed and **changes how many draws a word consumes**. That's
a deterministic-*output* change — fine as a versioned retrain (seeds change, like the
Mulberry32→SFC32 switch), but it must be called out as observable and is **not**
output-preserving.

---

## 4. Recommendation

**Confirm the card's hypothesis, with a sharpened split:**

1. **Names → real lists + combinatorial product + Feistel/FPE (options 1 + 2).** This is
   the strongest fit on *every* axis the library values: best quality (real names), big
   size win (real lists + succinct storage beat 2.34 MB easily), fastest generation (O(1)
   lookup), **and the only option that gives guaranteed non-repeating uniqueness** — which
   is exactly what a mock-data library needs ("10k distinct users"), and which the current
   Markov path cannot do. It is also the *cleanest, most robust* determinism fit (constant
   PRNG consumption, §3.1).
2. **Words → real lemma lists + weighted PCFG (option 6), with syllable n-grams (option 3)
   as the pseudo-word fallback** where invented words are explicitly wanted. Markov-invented
   words lose on both quality and size.
3. **Quantize + prune (option 4) as an immediate, low-risk stopgap** to cut the current
   2.34 MB by an estimated 4–8× *before* the larger refactor lands — useful if bundle size
   is pressing now. It buys time but doesn't fix quality or uniqueness.
4. **Neural (option 5): dismissed** — documented in §2.5 so it is settled.

### 4.1 Proposed spike

A **research/measurement spike** (a `chore`/`research` follow-up, *not* yet a full
implementation) to de-risk option 1+2 with real numbers before committing:

- **Touches:** `packages/locale-names/` (the five origin groups) and
  `packages/locale-en/src/models/`; `scripts/` for a one-off build-time encoder
  (front-coding / DAFSA + brotli); `src/generators/data/markov/sample.ts` and
  `src/prng.ts` are *read* for the determinism design (the Feistel helper would live
  beside `prng.ts`).
- **Deliverables:** (a) take the *actual* training corpora behind today's models (or the
  real source lists), build front-coded + DAFSA + brotli variants, and **report measured
  sizes** per origin/locale to confirm the §2.2 estimate (target: full real first+last
  name set per locale **under ~250 KB**, vs 2.34 MB today); (b) a throwaway proof of the
  Feistel/FPE bijection over a real `N` (verified by an enumeration test, *via the
  test-writer flow*, not an ad-hoc node script) confirming non-repeating + deterministic;
  (c) a decision memo on `i`/slot wiring (§3.1) for the reviewer to confirm against D4/D9/D10.
- **Implies shipping new data?** **Yes — likely.** Moving from trained models to real
  curated wordlists changes *what data ships* and its licensing/provenance. That is a
  **decision needing user sign-off** (which is why B45 is `flags: [review]`). The spike
  should surface the candidate corpora + licenses before any retrain/commit.

### 4.2 Relationship to B2 and B42

- **B2 (Markov entropy for *unkeyed* synthetic strings):** complementary. B2 targets
  fields *not* covered by key heuristics — a different surface. If words move to real
  lists + PCFG, B2's "plausible filler" need could be met by the same syllable-n-gram
  (option 3) sampler rather than a new char-Markov path; the recommendation here gives B2
  a better building block.
- **B42 (nl initial-letter A/B/C/D skew, issue #24):** a recommended direction here can
  **subsume B42.** The skew is a property of the start-state distribution baked into the
  trained model (visible directly in the `""` start row of `dutch/male.ts`: `a`≈8.7 %,
  `b`≈4.3 %, … — the empty-state CDF *is* the start-letter distribution, and it is what
  repeated sampling inherits). **Real wordlists + a uniform Feistel permutation over the
  list eliminate start-state skew entirely** — every list entry is equally reachable, so
  the initial-letter distribution is simply the *real* distribution of the list, by
  construction. So adopting option 1 for names (and option 6 for words) **fixes B42 as a
  side effect** rather than patching the sampler's start-state weighting. If the manager
  wants a faster, narrower fix, B42 can still be addressed independently (a `uniformStart`
  option or a retrain), but the strategic direction here makes it moot. **Coordinate:** do
  not ship a B42 sampler patch that the option-1 refactor would immediately delete — fold
  B42 into the recommended direction's sign-off, or scope it as the explicit stopgap.

---

## 5. Open questions (need user / maintainer sign-off)

1. **Corpus / data shipping.** Switching names to real wordlists changes *what data
   ships*. Which corpora? (The existing models were trained on SSA names, US Census
   surnames, Meertens/CBS for nl, etc. — are those source lists available to ship
   *directly*, or only as trained models?)
2. **Licensing.** Real wordlists carry licenses (WordNet, OpenTaal GPL/BSD, census public
   domain, Meertens open data). Shipping the *lists* (not derived models) may have
   different obligations than shipping the models. Needs legal/maintainer confirmation.
3. **Bundle-size budget.** What is the acceptable per-locale shipped budget? (Baseline:
   2.34 MB names + 0.53 MB EN words today; the recommendation targets a large reduction,
   but the exact budget drives DAWG-vs-brotli-vs-front-coding choice.)
4. **Unique-enumeration semantics by default.** Should `world.populate(Person, 10_000)`
   guarantee 10k *distinct* names by default (Feistel walk), or keep
   independent-with-collisions sampling? This is an observable behavior/contract choice
   (relates to the `{ unique }` opt-outs elsewhere) and a possible new option surface.
5. **Determinism-break tolerance.** Any of options 1/3/4/6 changes seed→value mappings
   (existing snapshots/tests shift), exactly like the Mulberry32→SFC32 switch. Confirm a
   minor/major bump and a coordinated re-pin is acceptable (0.x SemVer convention per B39).
6. **B42 handling.** Fold B42 into this direction's sign-off (subsumed by real-lists +
   uniform permutation), or ship a standalone stopgap (`uniformStart`/retrain) first?
