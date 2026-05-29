---
"zod4-mock": patch
---

Extract `resolveRelationPool` shared between `resolveRelated` and `resolveRelatedMany` (twin methods, ~80% duplicate). Internal refactor; PRNG fork keys + `where` filter behaviour unchanged.
