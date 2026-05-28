---
"zod4-mock": patch
---

Fix: nested-object overrides no longer skip the matcher. When a field has both a matcher and a partial-object override (e.g. matcher returns `{ bio, avatar }` and override is `{ bio }`), the matcher now runs and the override is deep-merged on top — preserving matcher-only leaves. Same fix applies to the per-schema key map and custom world-level generator branches; primitives and arrays keep replace semantics. Aligns runtime with the documented `DeepPartial<input<T>>` override typing. (closes #12)
