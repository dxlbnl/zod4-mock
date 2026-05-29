---
"zod4-mock": patch
---

Replace `generateZodString`'s 22-arm format chain with a `FORMAT_GENERATORS` dispatch table at file top. Internal refactor; check-format ordering and fallback path unchanged.
