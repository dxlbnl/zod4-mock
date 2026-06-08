---
"zod4-mock": minor
---

Add per-field TSDoc to every `GenerateOptions` and `WorldOptions` field so the API reference shows a description for each option. Add the shared `GenerationDefaults` base type (`WorldOptions`/`GenerateOptions` now `extends` it — same public shape). `source`/`fieldPath`/`prng` on `GenerateOptions` are now `@internal` (doc-only; non-breaking).
