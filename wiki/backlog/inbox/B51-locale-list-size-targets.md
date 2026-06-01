---
id: B51
title: Locale corpora — size targets + Zipf-distributed (frequency-weighted) picks
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
This item decides the right **per-list size targets** AND the **draw distribution** —
which, per the maintainer decision below, changes from uniform to **Zipf-weighted**.

## Direction (maintainer decision, 2026-06-01)

**Ship a Zipf-distributed (frequency-weighted) pick as the DEFAULT** (pre-v1 latitude),
with the exponent tunable as a setting; `exponent = 0` recovers today's uniform pick.

Rationale: name/word frequencies are heavy-tailed power laws (Zipf). Drawing
proportionally to real frequency makes mock data look like production (repeated "John
Smith"s, common words dominating) — good for testing dedup, `GROUP BY`, "most-common"
UIs, sort stability. Pre-v1 is the moment to make realism the default.

### Mechanism — inverse-transform sampling on a freq-sorted list (no shipped weights)

The sort order **is** the distribution. Draw a rank from a continuous power law and
index in. With `u = prng.random()`, exponent `s`, list length `N`:

```
        ⎧  (N+1)^u                                  if s = 1   (classic Zipf)
  r(u) = ⎨  1 + u·N                                 if s = 0   (uniform — today's pick)
        ⎩  [1 + u·((N+1)^(1-s) − 1)]^(1/(1-s))       otherwise (general power law)

  index = clamp(floor(r) − 1, 0, N − 1)
```

Properties (all load-bearing for this codebase):

- **One `prng.random()` draw** — same PRNG consumption as uniform `pick`, so per-field
  fork + counter semantics (D4/D10) are unchanged. MUST be closed-form inverse-CDF; a
  rejection sampler (Hörmann–Derflinger) would consume variable draws and break
  counter-neutrality — do not use one.
- **Zero extra payload** — no per-entry counts, no CDF table, no search. Reuses the
  freq-sorted order the corpora already keep for truncation.
- **Isomorphic** (`Math.pow`/`Math.floor` only) — clean under D13.
- **Plugs in one layer deep** in the data generators (`person.ts`/`word.ts`), reading
  the locale exponent; engine/pipeline unchanged (matches B46 §4 — swaps the uniform
  fallback path for a Zipf pick).

### Setting shape (to validate)

Maintainer lean: **ship the factor as a locale setting** (`frequencyExponent` on the
locale, default ~1). But the exponent is arguably more *corpus-type*-specific than
locale-specific (words ≈1, surnames ≈0.6–0.7), so the recommended shape is a
**locale-level default with optional per-corpus overrides**. Research validates the
actual exponents against real frequency data and recommends defaults.

## Questions to answer

1. **Per-corpus size targets.** Entry counts that give plenty of variety without
   bloating the bundle (maintainer prior: ~2K may be plenty for surnames). Recommend a
   target per corpus (first-names male/female, surnames, nouns, adjectives) for both
   locales, with the OTW brotli cost of each (extrapolate from B46 §3.1 + B50 ratios).
   NOTE the interaction with Zipf: under a steep draw, the effective variety is far
   below N anyway, so a smaller curated head may cost almost nothing in realism.
2. **Default exponent per corpus.** Validate `s` against real frequency data — US
   Census surnames (counts available), SSA first names (counts available), word
   frequency (SUBTLEX/Zipf ≈1). Recommend concrete defaults (e.g. surnames ~0.65,
   first names ~0.75, words ~1.0) and the single locale-level default if only one knob
   ships.
3. **Frequency-sort is now load-bearing.** Confirm which shipped corpora are
   frequency-sorted vs alphabetical, and ensure all draw-target corpora ship in
   **descending frequency order** (the Zipf substrate). `last-names` is freq-sorted;
   verify SSA first names retain count order; dwyl `words_alpha` has **no** frequency
   signal — flag that words may need a frequency-ranked source (SUBTLEX) or fall back
   to uniform (`s=0`) until one is sourced.
4. **Compare with faker.** Corpus sizes faker ships for equivalent lists, and whether
   faker weights draws (it uses uniform `arrayElement`) — so Zipf-default is a
   deliberate divergence worth documenting. Read-only; do **not** add faker as a dep.
5. **Uniqueness / collision impact.** Quantify how Zipf-default affects "generate N
   distinct entities": collisions arrive far sooner; interacts with B8 `unique` /
   `world.get` (more upserts/retries). Document the `frequencyExponent: 0` opt-out as
   the mitigation and recommend whether `unique`-context generation should auto-flatten.

## Deliverable

`wiki/research/text-generation/locale-list-size-targets.md`: per-corpus target size +
OTW cost; recommended default exponents validated against real frequency data; the
setting shape (locale default vs per-corpus); a faker comparison; the uniqueness
trade-off + opt-out; and the concrete config + trim targets an implementation item
would apply. Spin the Zipf-pick implementation off as its own `feature` card once the
exponents/targets are signed off.

## Notes

- **Do NOT modify any code.** Read-only analysis; writes only the research report.
- **Predecessors**: B50 (encoding null-result), B46 spike (§3 sizes, §7.2 Q-B1 surname
  sizing deferred to here). `prng.pick` confirmed uniform at
  [src/prng.ts:91-93](../../../src/prng.ts) — `s=0` reproduces it exactly.
- `flags: [review]` — Zipf-as-default is a notable pre-v1 behavior change and the
  exponent/target choices need maintainer sign-off before an implementation card is filed.
