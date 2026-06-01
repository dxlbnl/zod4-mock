---
id: B50
title: Smarter isomorphic encoding for locale corpora (beat plain string[] on size + speed)
type: research
priority: medium
flags: [review]
created: 2026-06-01
report: wiki/research/text-generation/isomorphic-corpus-encoding.md
---

## Description

The 0.9.0 data layer shipped each locale corpus as a `node:zlib` brotli blob
decompressed at module load — which breaks isomorphism (D13: shipped code MUST run
in browsers, MSW, service workers, edge). The in-flight fix reverts to plain
TypeScript `string[]` constants the consumer's bundler can compress. That is correct
and universal, but it is the _simplest_ possible encoding.

This item asks: **under the D13 isomorphism constraint, is there an encoding smarter
than plain `string[]` arrays that meaningfully wins on bundle size and/or load speed —
without reintroducing a `node:*` dependency?**

The B46 spike ([wordlist-sourcing-spike.md](../../research/text-generation/wordlist-sourcing-spike.md))
already costed `front-coded`, `gzip`, `brotli`, and `DAFSA`, but its recommendation
(`fc+brotli`) assumed Node's built-in `zlib` and is **void for any shipped path** under
D13. The size/speed question must be re-answered with a pure-cross-runtime-JS decode
constraint.

## Key constraints (from D13 + the engine)

- **No `node:*`** in the shipped path; must decode in pure JS across browser / MSW /
  edge / Node.
- Must support **`prng.pick`** — random index access into the materialized list
  (see B46 §4; per-call PRNG consumption is one draw, and must stay that way).
- Must preserve (or explicitly justify changing) the `LocaleData` `readonly string[]`
  contract in `packages/locale-core/src/types.ts`.
- "Bundle size" that matters is **over-the-wire (post-bundler-gzip/brotli)**, not raw
  source bytes — the consumer's bundler already compresses. Quantify both.

## Encodings to evaluate (at minimum)

1. **Plain `string[]` constants** (the in-flight baseline).
2. **Single packed delimited string** (`"a\nb\nc".split("\n")` at load) — fewer array-
   literal tokens; how does it bundle/gzip vs. an array literal, and what's the
   `.split` cost?
3. **Front-coded prefix compression** decoded by a tiny pure-JS function (no zlib).
4. **Pure-JS DAFSA / trie** with `prng.pick`-compatible indexed enumeration.
5. **`DecompressionStream` / brotli-via-WASM** — note feasibility but it's async and
   heavier; likely fails the simplicity bar. Assess only briefly.

## Metrics to report (per encoding, per representative corpus)

- shipped source bytes; **post-gzip / post-brotli over-the-wire bytes** (what a
  consumer's bundler emits);
- module-load decode/parse time (order-of-magnitude);
- `prng.pick` random-access cost;
- implementation + maintenance complexity (LOC of decoder, build-script changes).

## Deliverable

`wiki/research/text-generation/isomorphic-corpus-encoding.md`: a comparison table
across the encodings on the metrics above, then a single recommendation (keep plain
`string[]`, or adopt one of the smarter schemes), with the bundle-size and load-speed
deltas that justify it. If the recommendation is "keep plain arrays," say so plainly —
a null result is a valid outcome. Flag any blocking decisions for sign-off.

## Notes

- **Do NOT modify any code.** The locale data layer is being actively rewritten by
  another agent in the working tree (brotli → plain `string[]`); this item is
  read-only analysis that writes only the research report. Reason from known
  compression ratios + the B46 measured numbers; do not run scripts that write under
  `packages/`.
- Current in-tree sizes for anchoring: old blobs were `en.br` 70,798 B / `nl.br`
  42,127 B; the new plain-`.ts` data files total ~575 KB raw source across both
  locales (largest: `locale-en/last-names.ts` ~124 KB for 10K surnames).
- **Predecessors / context**: D13 (isomorphism rule), B46 spike, B48 (Markov→wordlist).
- `flags: [review]` — any adopted encoding change is architecturally significant and
  affects the locale packages; user signs off before an implementation item is spun off.
