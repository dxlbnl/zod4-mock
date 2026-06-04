---
"zod4-mock": patch
---

Fix B36 eager `bindGenerators` perf regression (lazy per-namespace binding + class PRNG + lazy `WorldImpl` Maps). Adds a matcher-tier bench and backfills the historical bisect.
