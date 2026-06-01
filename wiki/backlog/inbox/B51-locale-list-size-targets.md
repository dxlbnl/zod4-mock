---
id: B51
title: Locale list-size targets + entropy/realism tuning (trim corpora; freq-sort vs weighted pick)
type: research
priority: medium
flags: [review]
created: 2026-06-01
report: wiki/research/text-generation/locale-list-size-targets.md
---

## Description

B50 ([isomorphic-corpus-encoding.md](../../research/text-generation/isomorphic-corpus-encoding.md))
concluded that **list size — not encoding — is the dominant over-the-wire (OTW) lever**:
the 10K-entry `last-names` corpus is ~38–45 KB brotli OTW and swamps everything else.
This item decides the right **per-list size targets** and the **realism model** behind
the draw.

Two facts established up front (so the item starts from the right model):

- **`prng.pick` is uniform** ([src/prng.ts:91-93](../../../src/prng.ts)):
  `items[floor(random() * length)]`. Every entry has probability `1/N`. **List
  position does not affect selection probability** — a frequency-sorted list does
  **not** make common names more likely to be drawn.
- **Frequency sorting only matters for truncation.** Keeping the top-K of a
  frequency-sorted list = the K most *common* entries (realistic). Truncating an
  alphabetically-sorted list would keep `Aaberg…` and drop `Smith`. So freq-sort
  earns its keep as the truncation key, not as a draw bias.

## Questions to answer

1. **Per-corpus size targets.** What entry counts give "plenty" of variety without
   bloating the bundle? The maintainer's prior: **~2K may be plenty** for surnames.
   Recommend a target per corpus (first-names male/female, surnames, nouns,
   adjectives) for both locales, with the OTW brotli cost of each target (extrapolate
   from B46 §3.1 + B50's ratios).
2. **Compare with faker.** What corpus sizes does `@faker-js/faker` ship for the
   equivalent lists (first names, last names, words/adjectives)? Use faker as a
   reference point for "enough variety" — are we over- or under-shooting? (Read-only:
   inspect faker's published locale data shape/sizes from public docs or an installed
   copy if present; do **not** add faker as a dependency.)
3. **Frequency-sort + truncation.** Confirm which shipped corpora are frequency-sorted
   vs alphabetical today, and which therefore *can* be trimmed top-K meaningfully.
   `last-names` is frequency-sorted (trim = top-K common); the SSA first-name and dwyl
   word lists — verify their current order and whether a freq signal is even available
   to truncate by (SSA has counts; dwyl `words_alpha` does not).
4. **Realism model: uniform vs weighted.** Should common names appear *proportionally
   more often* (real-world frequency), or is uniform-over-a-curated-list good enough?
   Weighted draw (a `sampleWeighted`-style pick) is a separate feature with
   determinism implications (more PRNG draws per call; D4/D10). Recommend uniform +
   top-K curation (simplest, deterministic) unless there's a strong realism case;
   if weighted is worth it, scope it as its own follow-up, don't fold it in here.

## Deliverable

`wiki/research/text-generation/locale-list-size-targets.md`: a per-corpus recommended
target size with OTW cost, a faker size comparison table, the freq-sort/truncation
applicability per corpus, and a uniform-vs-weighted recommendation. End with the
concrete trim targets an implementation item would apply.

## Notes

- **Do NOT modify any code.** Read-only analysis; writes only the research report.
  The locale data layer is being rewritten concurrently by another agent.
- **Predecessors**: B50 (encoding null-result), B46 spike (§3 measured sizes, §7.2
  Q-B1 surname-sizing decision deferred to here).
- `flags: [review]` — trimming corpora is a realism/variety trade-off and any
  weighted-draw change is architecturally significant; user signs off on the targets
  before an implementation item is filed.
