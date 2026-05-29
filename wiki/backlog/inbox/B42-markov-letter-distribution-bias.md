---
id: B42
title: BUG/quality — nl-locale Markov-generated words skew heavily toward A/B/C/D initial letters
type: bug
priority: medium
flags: [review]
created: 2026-05-29
---

## Description

GitHub issue [#24](https://github.com/dxlbnl/zod4-mock/issues/24). User
observed that nl-locale Markov-generated words (via
`ctx.gen.word.adjective(ctx)` + `ctx.gen.word.noun(ctx)`) skew strongly
toward initial letters A and B, with a tail into C and D — almost no
words starting at E or later.

User-classified as a quality concern ("It can't be coincidence all these
generated words start with A, B, C or D. I see 'Aar' multiple times.").

### Observation (from #24)

Sample output across multiple matcher calls (each `${adjective}_${noun}.ext`):

```
["Aar_Aade.m4a","Aand_Aant.m4a","Beedzaarti_Achtelen.m4a","Afvaam_Aanmeerd.m4a", ...]
["Catisch_Aalbegefl.m4a","Aarbaanste_Aanstest.m4a","Aanrisch_Aanbod.m4a", ...]
["Afzuinig_Accen.txt","Abekend_Aagen.doc","Blonterli_Aardbeid.txt", ...]
["Besgend_Aantuat.xlsx","Derend_Aangeven.zip","Docrig_Aagem.xlsx", ...]
```

Every word starts with A, B, C, or D. Many start with "Aa" or "Aar". This
strongly suggests a bias in either the Markov sampling start-state distribution
or the underlying training data.

### Possible root causes (to investigate)

1. **Training-data skew** — if the nl Markov model was trained on a
   dictionary or wordlist where A-prefixed entries dominate (e.g.
   alphabetically-truncated input, only the first ~10k entries), the start
   distribution is inherited from that bias. The packages/locale-names
   training pipeline + `scripts/train-markov.ts` may have a subtle slice
   that prioritizes alphabetically early entries.

2. **Start-state weighting in `sampleMarkov`** — the Markov sampler may
   pick start states by frequency in the training data, AND those frequencies
   are themselves dominated by short common prefixes (like "Aa-", "Aan-",
   "Aar-" which open many Dutch words). Without explicit smoothing or a
   start-state uniform-pick option, the sampler reproduces the source
   distribution's skew amplified by the small generator step.

3. **Generation-step amplification** — even with a fair start distribution,
   if the model's transition probabilities loop back to common letter
   sequences early, the realised distribution under repeated sampling can
   concentrate (Markov chains can have a stationary distribution that
   over-weights certain prefixes).

4. **A-prefix overrepresented in the source corpus** — Dutch has many
   "Aa-"-prefix words (~3-4% of the dictionary by some counts), but not the
   ~80% the output above suggests. Even a doubling of the natural
   frequency wouldn't produce this pattern.

The "Aar" repetition across multiple samples is the strongest signal:
either the start-state sampler is picking "Aar" deterministically often,
or the chain's high-probability path leads through "Aar" early.

### Severity

Medium quality regression. The output is technically valid Dutch-looking
text, but the distribution is unrealistic. Users who rely on
`ctx.gen.word.*` for diverse mock data (e.g. file names, labels) will get
suspicious-looking patterns that an observer notices immediately ("why are
all my files A-prefixed?").

Not a correctness bug (no crash, no contract violation), but a notable
quality issue worth investigating.

### Proposed investigation directions

- **A.** Inspect the trained Markov model in `packages/locale-names/`
  for nl. Print the start-state distribution. If "A-prefixes" dominate,
  the training data is the culprit.
- **B.** Check `scripts/train-markov.ts` for any alphabetical slicing or
  ordering bias in how training input is fed.
- **C.** Audit `sampleMarkov` in `packages/locale-core/` for the
  start-state sampling strategy. Compare against `prng.pick(starts)`
  vs frequency-weighted sampling.
- **D.** If the bias is data-inherited, retrain on a more representative
  Dutch corpus (or whiten the start-state distribution explicitly via
  uniform-pick).
- **E.** If the bias is sampler-inherited, add an option to
  `sampleMarkov(prng, model, { uniformStart?: boolean })` and toggle it
  on for the word generators.

Recommend filing as a **research** item first to investigate (A/B/C above
are read-only), then a follow-up `bug` if D/E requires code changes. The
investigation is the value here; the fix shape depends on findings.

Flagged `review` — investigation may surface that the bias is inherent
to the chosen training data, in which case a retrain decision needs
user sign-off (which corpus? how is "fair" defined?).

## Notes

- GitHub issue: [#24](https://github.com/dxlbnl/zod4-mock/issues/24).
- Closely related: B40 (just shipped) fixed the locale-not-forwarded bug
  that prevented this from being visible. Now that nl Markov output
  flows correctly, the underlying quality issue surfaces.
- Related research: [wiki/research/better-gen/](../../research/better-gen/index.md)
  (the broader generator-overhaul track), particularly the Markov-training
  pages.
- May want to coordinate with `packages/locale-names/` training pipeline
  ownership — that's where the model artifacts live.
- A regression test is tricky (Markov output is intentionally varied);
  the right test asserts a property like "across N samples, the initial
  letter distribution roughly matches the natural letter-frequency of the
  source language" (chi-squared or similar). Spec-writer to design.
