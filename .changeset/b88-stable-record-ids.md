---
"zod4-mock": minor
---

`TraceNode.id` is now the friendly `<typeName>#<index>` form (e.g. `person#1`), 1-based, derived from the schema's `.description` (else a `schema<id>` fallback) with registration-order `-N` collision disambiguation; `derivedFrom` resolves to the friendly source id.
