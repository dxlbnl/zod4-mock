---
"zod4-mock": patch
---

Replace `generateFromSchema`'s 38-case switch with a typed `DISPATCH` table. New Zod types are compile errors if missed. Internal refactor; behaviour unchanged.
