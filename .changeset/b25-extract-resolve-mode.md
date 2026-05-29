---
"zod4-mock": patch
---

Extract `resolveMode(schema): SchemaMode` and unify the derived/primary/ad-hoc dispatch across `generateSingleItem`, `generateArray`, `populate`, and `populateFrom`. Discriminated union gives exhaustive switching at compile time. Internal refactor; no behaviour change.
