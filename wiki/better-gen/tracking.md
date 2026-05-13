# better-gen: Implementation Tracking

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

Items are ordered by implementation priority within each pillar.

---

## Correctness

- [x] **Constraint awareness** — thread Zod `min`/`max`/`length` checks into key-based generators so they produce valid data on first try ([constraint-awareness.md](constraint-awareness.md))
- [~] **Data packing** — deferred: all current datasets are under 50 entries (the wiki threshold); revisit after Markov refactor when larger corpora are introduced ([data-packing.md](data-packing.md))

---

## Speed & Efficiency

- [x] **PRNG → SFC32** — replace Mulberry32 with SFC32 for better statistical distribution and a vastly larger period; seeds change (breaking) ([prng-batching.md](prng-batching.md))
- [x] **PRNG `bytes(n)`** — exposes bulk byte generation (4 bytes per SFC32 tick); uuid, nanoid, hexadecimal, alphanumeric, colorHex, jwt all refactored to use it ([prng-batching.md](prng-batching.md))
- [x] **Array batching** — `generateZodArray` pre-computes field base seeds once (O(F) hashes) and derives per-element seeds via `splitmix32` XOR; no string allocations per element; `Prng.seed` exposed to enable this ([batch-generation.md](batch-generation.md))
- [~] **Key matching trie** — deferred: exact-match lookup is already O(1) (plain object property access in V8); pattern fallback has only 5–8 rules; revisit if key map exceeds 300 entries ([key-matching.md](key-matching.md))

---

## Data & Realism

- [x] **Sibling awareness** — add `ctx.current` map so a field generator can read already-generated sibling values (e.g. `firstName` driving gendered output, `jobTitle`/`jobArea` driving `bio`, `creditCardIssuer` driving BIN prefix) ([sibling-awareness.md](sibling-awareness.md))
- [x] **Generator reuse fixes** — `url()` uses curated path segments; `domainWord()` uses tech/company vocab; `company.name()` has tech-style formats; new `system.ts` (platform, browser, semver, fileName, filePath, mimeType) and `color.ts` (colorName, colorHex, colorRgb, colorHsl) modules; all wired into key map ([generator-reuse.md](generator-reuse.md))
- [ ] **Localization** — pluggable `LocaleData` interface replacing hardcoded Dutch/English strings; English becomes default ⚠️ breaking ([localization.md](localization.md))
- [ ] **Markov word generation** — replace phoneme combinatorics with Order-2 Markov models trained per locale; open-class words (nouns, verbs, adjectives) only ([word-generation.md](word-generation.md))
- [ ] **Markov character entropy** — character-level Markov chains for synthetic string fields not covered by key heuristics ([algorithmic-entropy.md](algorithmic-entropy.md))
- [ ] **Markov training pipeline** — `train-markov.ts` / `verify-markov.ts` CLI tooling for building and inspecting locale models ([markov-training-pipeline.md](markov-training-pipeline.md))
- [ ] **Conjugation compression** — store only lemmas and derive inflected forms algorithmically to reduce corpus size 30–50% ([conjugation-compression.md](conjugation-compression.md))
