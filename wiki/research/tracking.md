# Data-Generation Overhaul: Implementation Tracking

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

Items are ordered by implementation priority within each pillar.

---

## Correctness

- [x] **Constraint awareness** — thread Zod `min`/`max`/`length` checks into key-based generators so they produce valid data on first try ([constraint-awareness.md](field-resolution/constraint-awareness.md))
- [~] **Data packing** — deferred: all current datasets are under 50 entries (the wiki threshold); revisit after Markov refactor when larger corpora are introduced ([data-packing.md](text-generation/data-packing.md))

---

## Speed & Efficiency

- [x] **PRNG → SFC32** — replace Mulberry32 with SFC32 for better statistical distribution and a vastly larger period; seeds change (breaking) ([prng-batching.md](engine/prng-batching.md))
- [x] **PRNG `bytes(n)`** — `prng.bytes(n)` is implemented; `generateUuid` and `generateNanoid` in both schema and data layers now use it ([prng-batching.md](engine/prng-batching.md))
- [x] **Array batching** — `generateZodArray` pre-computes field base seeds once (O(F) hashes) and derives per-element seeds via `splitmix32` XOR; no string allocations per element; `Prng.seed` exposed to enable this ([batch-generation.md](engine/batch-generation.md))
- [~] **Key matching trie** — deferred: exact-match lookup is already O(1) (plain object property access in V8); pattern fallback has only 5–8 rules; revisit if key map exceeds 300 entries ([key-matching.md](engine/key-matching.md))

---

## Data & Realism

- [x] **Sibling awareness** — add `ctx.current` map so a field generator can read already-generated sibling values (e.g. `firstName` driving gendered output, `jobTitle`/`jobArea` driving `bio`, `creditCardIssuer` driving BIN prefix) ([sibling-awareness.md](field-resolution/sibling-awareness.md))
- [x] **Generator reuse fixes** — `url()` uses curated path segments; `domainWord()` uses tech/company vocab; `company.name()` has tech-style formats; new `system.ts` (platform, browser, semver, fileName, filePath, mimeType) and `color.ts` (colorName, colorHex, colorRgb, colorHsl) modules; all wired into key map ([generator-reuse.md](field-resolution/generator-reuse.md))
- [x] **Localization** — pluggable `LocaleData` interface; `src/locales/*` removed and locale code moved to workspace packages: `@zod4-mock/locale-core` (types + `extend()`), `@zod4-mock/locale-en` (full English with Markov), `@zod4-mock/locale-nl` (Dutch with Markov), `@zod4-mock/locale-names` (shared cultural-origin Markov models). Main package ships a minimal Markov-free English locale as fallback when no `locale` is passed ([localization.md](text-generation/localization.md))
- [x] **Markov word generation** — Order-2 character-level Markov models trained on real corpora (SSA names, Census surnames, WordNet, OpenTaal) replace phoneme combinatorics; open-class words (nouns, adjectives) and names use locale-specific models ([word-generation.md](text-generation/word-generation.md))
- [ ] **Markov character entropy** — character-level Markov chains for synthetic string fields not covered by key heuristics ([algorithmic-entropy.md](text-generation/algorithmic-entropy.md))
- [x] **Markov training pipeline** — `train-markov.ts` / `verify-markov.ts` CLI tooling for building and inspecting locale models; training data in `data/training/` ([markov-training-pipeline.md](text-generation/markov-training-pipeline.md))
- [ ] **Conjugation compression** — store only lemmas and derive inflected forms algorithmically to reduce corpus size 30–50% ([conjugation-compression.md](text-generation/conjugation-compression.md))

---

## Complexity & consistency reports

- [x] **Complexity audit (2026-05-29)** — baseline; flagged `world.ts` (1202 LOC) + 15 items (B23–B37, all done) ([reports/codebase-complexity.md](reports/codebase-complexity.md))
- [x] **Complexity & consistency re-analysis (2026-06-01)** — delta pass: B23–B53 landed; `engine.ts` now 1748 LOC (top win = lift array/relations/bindGenerators out); codepaths verdict CONSISTENT bar one by-design pipeline subset + two stale-comment/`any` cleanups ([reports/codebase-complexity-2026-06-01.md](reports/codebase-complexity-2026-06-01.md))
