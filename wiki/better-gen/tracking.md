# better-gen: Implementation Tracking

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

Items are ordered by implementation priority within each pillar.

---

## Correctness

- [x] **Constraint awareness** — thread Zod `min`/`max`/`length` checks into key-based generators so they produce valid data on first try ([constraint-awareness.md](constraint-awareness.md))
- [ ] **Data packing** — store static locale lists ≥ 50 entries as delimited strings (`"a|b|c".split("|")`) to reduce V8 parse time ([data-packing.md](data-packing.md))

---

## Speed & Efficiency

- [x] **PRNG → SFC32** — replace Mulberry32 with SFC32 for better statistical distribution and a vastly larger period; seeds change (breaking) ([prng-batching.md](prng-batching.md))
- [ ] **PRNG `uint32()` / `bytes(n)`** — expose batch bit-extraction methods to reduce per-character RNG calls in uuid, nanoid, hex generators ([prng-batching.md](prng-batching.md))
- [ ] **Array batching** — when generating a `ZodArray`, pre-compute inner-schema field base seeds once before the element loop and derive per-element seeds via XOR; no new API — `generate(z.array(Schema).length(N))` becomes the batch path transparently; applies recursively to nested arrays ([batch-generation.md](batch-generation.md))
- [ ] **Key matching trie** — replace the linear 165-entry key map scan with a compiled trie for exact matches and a single merged regex for pattern fallback ([key-matching.md](key-matching.md))

---

## Data & Realism

- [x] **Sibling awareness** — add `ctx.current` map so a field generator can read already-generated sibling values (e.g. `firstName` driving gendered output, `jobTitle`/`jobArea` driving `bio`, `creditCardIssuer` driving BIN prefix) ([sibling-awareness.md](sibling-awareness.md))
- [x] **Generator reuse fixes** — `url()` uses curated path segments; `domainWord()` uses tech/company vocab; `company.name()` has tech-style formats; new `system.ts` (platform, browser, semver, fileName, filePath, mimeType) and `color.ts` (colorName, colorHex, colorRgb, colorHsl) modules; all wired into key map ([generator-reuse.md](generator-reuse.md))
- [ ] **New `system.ts` module** — OS, browser, file path, file-extension generators ([generator-reuse.md](generator-reuse.md), [methods-inventory.md](methods-inventory.md))
- [ ] **New `color.ts` module** — CSS color names, hex, rgb generators ([generator-reuse.md](generator-reuse.md), [methods-inventory.md](methods-inventory.md))
- [ ] **Localization** — pluggable `LocaleData` interface replacing hardcoded Dutch/English strings; English becomes default ⚠️ breaking ([localization.md](localization.md))
- [ ] **Markov word generation** — replace phoneme combinatorics with Order-2 Markov models trained per locale; open-class words (nouns, verbs, adjectives) only ([word-generation.md](word-generation.md))
- [ ] **Markov character entropy** — character-level Markov chains for synthetic string fields not covered by key heuristics ([algorithmic-entropy.md](algorithmic-entropy.md))
- [ ] **Markov training pipeline** — `train-markov.ts` / `verify-markov.ts` CLI tooling for building and inspecting locale models ([markov-training-pipeline.md](markov-training-pipeline.md))
- [ ] **Conjugation compression** — store only lemmas and derive inflected forms algorithmically to reduce corpus size 30–50% ([conjugation-compression.md](conjugation-compression.md))
