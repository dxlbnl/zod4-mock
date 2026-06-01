---
"zod4-mock": patch
---

Fix: unify `generateArray` mode arms + `populate` to apply bounds, overrides, and transform consistently.

Eight inconsistencies surfaced after B25 unified the classifier but each branch still hand-rolled its own bound logic. The user-visible bugs:

- `generateArray` derived mode silently ignored `.max()`, `.length()`, and the library-side `defaultArrayLength[1]` ceiling — returned one element per source pair regardless of bounds.
- `generateArray` primary mode under `{ store: false }` silently ignored `.max()` — the B44 store:false fix bypassed the B43 caller-max slice.
- `generateArray` primary mode silently dropped `options.transform` on both store-on and store-off paths.
- `generateArray` derived mode silently dropped `options.overrides` and `options.transform`.
- `populate(DerivedSchema, count)` silently truncated to `Math.min(count, sources.length)` instead of auto-provisioning sources.

Also: `populate`'s primary-first explicit pre-check is removed as dead code (D12 made the inversion-observable configuration unreachable), and `generateArray`'s ad-hoc arm now shares the `resolveMinRequired` / `resolveMaxAllowed` helpers instead of inlining the loop.

No API surface change. Patch bump.
