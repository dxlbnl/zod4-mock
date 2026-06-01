---
"zod4-mock": patch
---

Fix: per-index `options.overrides` on `world.generate(PrimarySchema.array(), ...)` now apply per record (field-level deep-merge via `generateAndStorePrimary`) instead of throwing.

The pre-B53 throw (added by B38) was a temporary loud-refusal of a call shape that was silently broken before B38 — overrides were silently dropped. B38 redirected callers to `world.populate(schema, count, factory)`, the API that already wired through per-record overrides. B52 unified the three array mode arms (derived, primary, ad-hoc) under a shared trailing pass, leaving the B38 throw as the only remaining asymmetry. B53 finishes the unification: the primary arm now applies `overrides[i]` per record via `generateAndStorePrimary`'s existing field-level merge path, exactly mirroring how `populate(S, N, factory)` works. D8 (registry stored = generate's return value) is preserved by construction — the merge happens BEFORE `registry.store`.

Pre-existing records in the registry are returned untouched (D8); overrides apply only to records produced by the current call (positions `[existingCount, target)` in the returned array). `options.transform` runs after the per-record override merge (B52-R3 ordering preserved). No public API surface change. Patch bump.
