---
"zod4-mock": patch
---

Extract `resolveLazyChain` helper (4 duplicate `while (d.type === "lazy")` loops collapsed to one). Internal refactor; behaviour unchanged.
