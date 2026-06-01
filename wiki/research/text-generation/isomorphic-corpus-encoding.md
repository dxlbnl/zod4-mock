# Isomorphic Corpus Encoding — does anything beat plain `string[]` over the wire? (B50)

> **Research report for backlog item
> [B50](../../backlog/doing/B50-isomorphic-corpus-encoding.md).** Read-only analysis;
> no code changed. Anchored to the measured numbers in the
> [B46 wordlist-sourcing spike](wordlist-sourcing-spike.md) §3 and to published
> gzip/brotli ratios.
>
> **Standing constraint:** [D13](../../decisions.md#d13-shipped-code-must-be-isomorphic-universal-runtime-no-node-in-published-paths) —
> shipped code MUST be runtime-agnostic (no `node:*`, no Node-only globals; runs in
> browser / MSW / service worker / edge). This **voids** B46's `fc+brotli`
> recommendation for any _shipped_ path (it assumed Node's `zlib`).

---

## TL;DR — recommendation

**Keep plain `string[]` constants. This is a null result, and it is the correct
outcome.**

Under D13, the only thing that travels over the wire is the **content** of the
corpora — the bundler gzip/brotli-compresses whatever we emit, and the JS wrapper
(`export const x = […]`) is almost entirely squeezed out by that same compression.
The schemes that beat plain content on raw bytes (front-coding, DAFSA) only win
_before_ the bundler's compressor runs; **after** it runs, they either tie plain
arrays or lose, while adding a decoder, a `node:*`-free build path, and an
eager decode cost on every cold start in every runtime. None of them clears the
simplicity bar for a single-digit-KB or even a ~40 KB win that the consumer's
bundler already mostly captures.

The one scheme worth a _maybe_ is the **single packed delimited string**
(`"a\nb\nc".split("\n")`): it is trivially isomorphic, costs ~20 bytes of decoder,
and shaves real **post-compression** bytes (the per-entry `"`, `",`, indentation
tokens vanish from the source the bundler sees). But it conflicts with per-corpus
tree-shaking only _within a file_ (we already split corpora into separate modules),
and the post-gzip delta is modest (~5–12 %). It is a legitimate **non-blocking**
follow-up if the maintainer wants the marginal win; it is not required.

---

## What actually ships today (working-tree baseline)

The in-flight fix emits each corpus as a separate plain-`string[]` module, one
per export, re-exported from a `node:*`-free barrel
([`packages/locale-en/src/data/index.ts`](../../../packages/locale-en/src/data/index.ts),
[`packages/locale-nl/src/data/index.ts`](../../../packages/locale-nl/src/data/index.ts)).
Measured raw source bytes (this working tree):

| corpus (locale-en)      | entries |       raw source bytes |
| ----------------------- | ------: | ---------------------: |
| `last-names.ts`         |  10,000 |                123,810 |
| `nouns.ts`              |   5,000 |                 72,454 |
| `first-names-female.ts` |  ~4,200 |                 48,579 |
| `adjectives.ts`         |   3,000 |                 47,151 |
| `first-names-male.ts`   |  ~1,200 |                 40,762 |
| **locale-en total**     |       — |            **~333 KB** |
| **locale-nl total**     |       — |            **~241 KB** |
| **both locales**        |       — | **~574 KB raw source** |

Two facts that shape the analysis:

1. **The array wrapper is ~6 bytes/entry of pure boilerplate** — `  "word",\n` is
   2-space indent + `"` + `"` + `,` + `\n` around each token. For the 10K-entry
   `last-names.ts`, that's ~60 KB of the 124 KB file that is _not_ corpus content.
   This is exactly the redundancy a compressor eats for breakfast.
2. **Sort order differs per corpus.** `nouns.ts`/`adjectives.ts` are
   alphabetically sorted (`aahed, aahing, aahs, aalii…`), so front-coding _could_
   apply. But `last-names.ts` is **frequency-sorted** (`smith, johnson, williams…`)
   — front-coding a frequency-sorted list buys almost nothing (no shared prefixes
   between adjacent entries), and re-sorting it alphabetically to enable
   front-coding would destroy the frequency ordering that makes `prng.pick` pick
   common surnames more… (it doesn't, actually — `prng.pick` is uniform, so order
   is cosmetic; but the point stands that the largest corpus is the _worst_ case
   for front-coding as currently emitted).

---

## The load-bearing insight: measure post-compression, not raw

The consumer's bundler (Vite/esbuild/rollup/webpack) serves assets gzip- or
brotli-compressed. So the real over-the-wire cost is **the compressed size of the
emitted module**, not its raw bytes. From B46 §3.1, the canonical anchor is the
english surname corpus _content_ (newline-joined, no JS wrapper):

| english `last-names` (88,448 entries, B46 §3.1) |   bytes | ratio vs raw |
| ----------------------------------------------- | ------: | -----------: |
| raw newline text                                | 691,618 |        1.00× |
| gzip −9                                         | 245,432 |        2.82× |
| brotli −11                                      | 195,155 |        3.54× |
| front-coded + brotli −11                        | 150,840 |        4.59× |

That **3.5×–4.6×** is the ratio a bundler achieves on the string _content_
regardless of the JS wrapper. The wrapper's `"…",\n` tokens are themselves highly
repetitive, so gzip/brotli collapse them to near-zero marginal cost: an array
literal and a single packed string of the same words compress to **within a few
percent of each other**. This is the crux — raw-byte comparisons (where packing
"saves" ~6 bytes/entry) overstate the real win by roughly the compression ratio.

For the _current_ 10K-entry english surname module (frequency-sorted, ~124 KB raw
source): expect **~38–45 KB brotli / ~52 KB gzip over the wire** as a plain array.
That is the number every other scheme has to beat _after the bundler runs_.

---

## Comparison table

Per representative corpus = english `last-names` (10K entries, ~124 KB raw source
as emitted). "OTW" = estimated over-the-wire bytes after the consumer's bundler
applies brotli −11. Estimates extrapolate the B46 §3.1 ratios onto the 10K-entry
shape (smaller and frequency-sorted vs B46's 88K alphabetical corpus, so absolute
numbers differ but ratios hold).

| #   | Encoding                                                  |         Shipped source bytes |                                                                                                        Est. OTW (brotli) | Load / decode cost                                                                                                                                                                                        | `prng.pick` access                                                                                                                                                                                                                | Decoder LOC / maint. complexity                                                                                                                       | Isomorphic (D13)?                                                                                                                         |
| --- | --------------------------------------------------------- | ---------------------------: | -----------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Plain `string[]`** (baseline)                           |                      ~124 KB |                                                                                                            **~38–45 KB** | **0** (JS engine parses the literal; array is live immediately)                                                                                                                                           | `arr[idx]` — O(1), array already materialized                                                                                                                                                                                     | **0 LOC.** Build script emits literals. Tree-shakeable per module.                                                                                    | ✅ trivially                                                                                                                              |
| 2   | **Single packed `"\n"`-joined string** + `.split("\n")`   | ~64 KB (wrapper tokens gone) |                                                                                         **~34–40 KB** (≈5–12 % under #1) | One `String.prototype.split` over ~64 KB at module load — sub-ms to low-ms once; native C++                                                                                                               | O(1) after split materializes the same array                                                                                                                                                                                      | **~1–3 LOC** (`"…".split("\n")`). Build script joins instead of emitting literals. Still one module per corpus → still tree-shakeable across corpora. | ✅ trivially                                                                                                                              |
| 3   | **Front-coding** (`<prefix-len><suffix>`), pure-JS decode |                  ~70–95 KB\* |                                                                **~38–46 KB** (≈ ties #1; _worse_ on freq-sorted corpora) | Pure-JS loop rebuilding N strings from prefix deltas: O(total chars), low-ms for 10K                                                                                                                      | O(1) after full decode (must materialize whole list up front for uniform `prng.pick`)                                                                                                                                             | **~15–25 LOC** decoder + build-side encoder; only helps alphabetically-sorted corpora; brittle around multibyte/sort assumptions                      | ✅ (pure JS) but adds code                                                                                                                |
| 4   | **Pure-JS DAFSA / trie**                                  |            ~60–80 KB (graph) | **~30–38 KB** (~15–25 % under #1 _raw_; the post-brotli edge shrinks because brotli already finds the shared substrings) | Build the in-memory automaton **and enumerate all N words** to support uniform `prng.pick` → equivalent to materializing the array anyway, plus graph-walk overhead. Higher than #1.                      | `prng.pick` needs a flat indexable list ⇒ must enumerate the DAFSA to an array at load (or implement ranked k-th-word lookup, which B46 §3.2 explicitly says is no longer needed). Either way O(1) _after_ a more expensive load. | **~60–150 LOC** builder + decoder; the heaviest maintenance surface by far                                                                            | ✅ (pure JS) but heavy                                                                                                                    |
| 5   | **`DecompressionStream` / WASM-brotli**                   |               ~38–45 KB blob |                                                    **~38–45 KB** (already compressed; bundler can't re-compress further) | **Async** (`DecompressionStream` is stream/Promise-based) **or** ship a WASM brotli decoder (tens of KB of WASM, dwarfs the savings). Forces an async boundary into a today-synchronous module-load path. | O(1) after async decode resolves — but the whole locale load becomes async                                                                                                                                                        | **High.** Either an async refactor of every locale consumer or a bundled WASM decoder.                                                                | ⚠️ `DecompressionStream` is in modern browsers/Node/Deno/workers but **not universally** (older edge/RN); WASM path is portable but heavy |

\* Front-coding gain is corpus-dependent: ~30 % raw reduction on alphabetically
sorted corpora (B46: 691,618 → 394,082 = 1.75× on the 88K alpha list), but the
shipped `last-names` is **frequency-sorted**, where front-coding saves almost
nothing without a re-sort.

---

## Why the "smarter" schemes don't pay off under D13

- **The bundler is already the brotli stage.** B46's `fc+brotli` win (150,840 vs
  195,155 = ~23 % under plain brotli) was real — but it stacked a _custom_
  front-coding pass _underneath_ Node's brotli. Under D13 we can't run brotli at
  ship time on a shipped artifact (that's `node:zlib`), and we can't re-compress
  what the bundler already compressed. So front-coding (#3) only competes against
  the **bundler's** brotli on raw content, and brotli's LZ window already discovers
  most of the shared prefixes front-coding encodes explicitly. The two largely
  overlap → near-tie post-bundler, with #3 carrying a decoder #1 doesn't need.

- **DAFSA (#4) breaks the access model.** `prng.pick` (see
  [`src/generators/data/person.ts:48`](../../../src/generators/data/person.ts) and
  [`word.ts:55`](../../../src/generators/data/word.ts)) is a uniform random index
  into a _materialized_ `readonly string[]`, one PRNG draw per call (B46 §4). A
  DAFSA stores words as a shared-suffix graph with **no** flat index; supporting
  `prng.pick` means enumerating the whole automaton into an array at load — so you
  pay DAFSA's decode cost _and_ end up with the same array plain arrays give you
  for free. B46 §3.2 already concluded "skip DAFSA" even when `node:zlib` was
  allowed; under D13 it's strictly worse.

- **Compressed blobs (#5) fight the bundler and the runtime.** A pre-brotli'd blob
  can't be re-compressed by the bundler (it's already high-entropy), so OTW bytes
  ≈ the blob — no better than letting the bundler brotli a plain array. Decoding it
  isomorphically means `DecompressionStream` (async, not universal on older
  edge/RN) or a bundled WASM brotli (tens of KB — larger than the savings on our
  corpus sizes). This is exactly the class of approach D13 was written to forbid.

- **Packed string (#2) is the only marginal real win.** It removes the
  `"…",\n` wrapper tokens _from the source the bundler sees_, so even after
  compression there's a small genuine delta (the wrapper isn't perfectly
  redundant — indentation + quotes + commas interleave with varying word lengths).
  Expect ~5–12 % OTW reduction, a one-liner decoder, full isomorphism, and **no**
  change to `prng.pick` (the array is identical after `.split`). Its only cost: a
  packed string is one tree-shaking unit — but corpora are already one module per
  export, so cross-corpus tree-shaking is unaffected; only the (already whole-file)
  intra-corpus granularity is lost, which is a non-issue (no one imports half a
  surname list).

---

## `prng.pick` / `LocaleData` contract impact

- The `LocaleData` contract is `readonly string[]` per field
  ([`packages/locale-core/src/types.ts:38-42,113-116`](../../../packages/locale-core/src/types.ts)).
  Both surviving candidates (#1 plain, #2 packed) **preserve it exactly** — #2
  produces a `string[]` via `.split` at module load, identical shape, identical
  uniform-index `prng.pick`, one PRNG draw per call. **No `LocaleData` change, no
  generator change** (`person.ts`/`word.ts` are untouched).
- #3/#4 would also have to materialize a `string[]` to honor `prng.pick`, so they
  buy nothing on the access side either — they only add decode cost and code.

---

## Blocking vs non-blocking decisions (for maintainer sign-off)

### Blocking

- **None.** The recommendation is to keep the in-flight plain-`string[]` baseline,
  which is already what the working tree ships and is fully D13-compliant. No
  decision is required to _stay the course_; B50 can close as a null-result research
  item with the report linked.

### Non-blocking (optional, maintainer's call)

- **N-1 — Adopt the packed `"\n"`-string encoding (#2)?** ~5–12 % over-the-wire
  reduction on the large corpora (single-digit KB on `last-names`), ~1–3 LOC
  decoder, fully isomorphic, no contract/API change. Worth filing as a small
  `chore`/`lite` implementation item _only if_ the maintainer wants the marginal
  win; otherwise skip. If adopted, apply it **only** to the large corpora
  (`last-names`, `nouns`, first-name lists) per the
  [data-packing.md](data-packing.md) ">~50 entries, never tree-shaken individually"
  guidance, and leave small closed-class lists (articles, prepositions, …) as plain
  literals.
- **N-2 — Largest-corpus sizing.** Orthogonal to encoding: the 10K-entry
  `last-names` is the dominant OTW cost (~38–45 KB brotli). If bundle size matters
  more than surname variety, trimming to top ~2–5K surnames beats _any_ encoding
  scheme on OTW bytes. This is a data-curation decision (B46 §7.2 Q-B1 territory),
  not an encoding one — flagged here only because it dominates the budget the
  encoding question was trying to shave.
- **N-3 — Revisit only if corpora grow ~10×.** If a future locale ships a
  multi-hundred-KB corpus, re-open the packed-string question (and _only_ the
  packed-string question — #3/#4/#5 remain ruled out under D13).

---

## See also

- [D13 — isomorphism standing constraint](../../decisions.md#d13-shipped-code-must-be-isomorphic-universal-runtime-no-node-in-published-paths)
- [B46 wordlist-sourcing spike](wordlist-sourcing-spike.md) — §3.1/§3.2 measured
  front-coded / gzip / brotli / DAFSA numbers; §4 the `prng.pick` access pattern
- [B50 backlog card](../../backlog/doing/B50-isomorphic-corpus-encoding.md)
- [data-packing.md](data-packing.md) — the packed-delimited-string technique and
  its tree-shaking caveat
- [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts)
  — the `LocaleData` `readonly string[]` contract
